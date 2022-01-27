use std::{collections::HashMap, path::PathBuf, time::Duration};

use error::{bail, ensure, report, Result, ResultExt};
use hash_engine::{
    experiment::controller::config::{OutputPersistenceConfig, OUTPUT_PERSISTENCE_KEY},
    output::local::config::LocalPersistenceConfig,
    proto,
    proto::{
        ExecutionEnvironment, ExperimentId, ExperimentName, ExperimentPackageConfig,
        ExperimentRunBase, SimpleExperimentConfig, SingleRunExperimentConfig,
    },
    simulation::command::StopStatus,
    utils::OutputFormat,
};
use rand::{distributions::Distribution, Rng, RngCore};
use rand_distr::{Beta, LogNormal, Normal, Poisson};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as SerdeValue};
use tokio::time::{sleep, timeout};

use crate::{exsrv::Handler, process};

#[derive(Debug, Clone, Default)]
pub struct ExperimentConfig {
    pub num_workers: usize,
    pub emit: OutputFormat,
    pub output_folder: PathBuf,
    pub engine_start_timeout: Duration,
    pub engine_wait_timeout: Duration,
}

#[derive(Debug, Clone)]
pub enum ExperimentType {
    SingleRun { num_steps: usize },
    Simple { name: ExperimentName },
}

impl ExperimentType {
    pub fn get_package_config(self, base: &ExperimentRunBase) -> Result<ExperimentPackageConfig> {
        match self {
            ExperimentType::SingleRun { num_steps } => Ok(ExperimentPackageConfig::SingleRun(
                SingleRunExperimentConfig { num_steps },
            )),
            ExperimentType::Simple { name } => Ok(ExperimentPackageConfig::Simple(
                get_simple_experiment_config(base, name)
                    .wrap_err("Could not read simple experiment config")?,
            )),
        }
    }
}

pub struct Experiment {
    pub config: ExperimentConfig,
}

impl Experiment {
    pub fn new(config: ExperimentConfig) -> Self {
        Self { config }
    }

    pub fn create_engine_command(
        &self,
        experiment_id: ExperimentId,
        controller_url: &str,
    ) -> Result<Box<dyn process::Command + Send>> {
        Ok(Box::new(process::LocalCommand::new(
            experiment_id,
            self.config.num_workers,
            controller_url,
            self.config.emit,
        )?))
    }

    #[instrument(skip_all, fields(project_name = project_name.as_str(), experiment_id = %experiment_run.base.id))]
    pub async fn run(
        &self,
        experiment_run: proto::ExperimentRun,
        project_name: String,
        mut handler: Handler,
    ) -> Result<()> {
        let experiment_name = experiment_run.base.name.clone();
        let mut engine_handle = handler
            .register_experiment(experiment_run.base.id)
            .await
            .wrap_err_lazy(|| format!("Could not register experiment \"{experiment_name}\""))?;

        // Create and start the experiment run
        let cmd = self
            .create_engine_command(experiment_run.base.id, handler.url())
            .wrap_err("Could not build engine command")?;
        let mut engine_process = cmd.run().await.wrap_err("Could not run experiment")?;

        // Wait to receive a message that the experiment has started before sending the init
        // message.
        let msg = timeout(self.config.engine_start_timeout, engine_handle.recv())
            .await
            .wrap_err("engine start timeout");
        match msg {
            Ok(proto::EngineStatus::Started) => {}
            Ok(m) => {
                bail!(
                    "expected to receive `Started` message but received: `{}`",
                    m.kind()
                );
            }
            Err(e) => {
                error!("Engine start timeout for experiment \"{experiment_name}\"");
                engine_process
                    .exit_and_cleanup()
                    .await
                    .wrap_err("Failed to cleanup after failed start")?;
                bail!(e);
            }
        };
        debug!("Received start message from \"{experiment_name}\"");

        let map_iter = [(
            OUTPUT_PERSISTENCE_KEY.to_string(),
            json!(OutputPersistenceConfig::Local(LocalPersistenceConfig {
                output_folder: self.config.output_folder.clone()
            })),
        )];
        // Now we can send the init message
        let init_message = proto::InitMessage {
            experiment: experiment_run.clone().into(),
            env: ExecutionEnvironment::None, // We don't connect to the API
            dyn_payloads: serde_json::Map::from_iter(map_iter),
        };
        engine_process
            .send(&proto::EngineMsg::Init(init_message))
            .await
            .wrap_err("Could not send `Init` message")?;
        debug!("Sent init message to \"{experiment_name}\"");

        let mut errored = false;
        loop {
            let msg: Option<proto::EngineStatus>;
            tokio::select! {
                _ = sleep(self.config.engine_wait_timeout) => {
                    error!(
                        "Did not receive status from experiment \"{experiment_name}\" for over {:?}. \
                        Exiting now.",
                        self.config.engine_wait_timeout
                    );
                    break;
                }
                m = engine_handle.recv() => { msg = Some(m) },
            }
            let msg = msg.unwrap();
            debug!("Got message from experiment run with type: {}", msg.kind());

            match msg {
                proto::EngineStatus::Stopping => {
                    debug!("Stopping experiment \"{experiment_name}\"");
                }
                proto::EngineStatus::SimStart { sim_id, globals: _ } => {
                    debug!("Started simulation: {sim_id}");
                }
                proto::EngineStatus::SimStatus(status) => {
                    debug!("Got simulation run status: {status:?}");
                    for stop_message in status.stop_msg {
                        let reason = if let Some(reason) = stop_message.reason.as_ref() {
                            format!(": {reason}")
                        } else {
                            String::new()
                        };
                        match stop_message.status {
                            StopStatus::Success => {
                                tracing::info!("Simulation stopped sucessfully{reason}");
                            }
                            StopStatus::Warning => {
                                tracing::warn!("Simulation stopped with a warning{reason}");
                            }
                            StopStatus::Error => {
                                errored = true;
                                tracing::error!("Simulation stopped with an error{reason}");
                            }
                        }
                    }
                    // TODO: OS - handle more status fields
                }
                proto::EngineStatus::SimStop(sim_id) => {
                    debug!("Simulation stopped: {sim_id}");
                }
                proto::EngineStatus::Errors(sim_id, errs) => {
                    error!("There were errors when running simulation [{sim_id}]: {errs:?}");
                    errored = true;
                }
                proto::EngineStatus::Warnings(sim_id, warnings) => {
                    warn!("There were warnings when running simulation [{sim_id}]: {warnings:?}");
                }
                proto::EngineStatus::Logs(sim_id, logs) => {
                    for log in logs {
                        if !log.is_empty() {
                            info!(target: "behaviors", "[{experiment_name}][{sim_id}]: {log}");
                        }
                    }
                }
                proto::EngineStatus::Exit => {
                    debug!("Process exited successfully for experiment run \"{experiment_name}\"",);
                    break;
                }
                proto::EngineStatus::ProcessError(error) => {
                    error!("Got error: {error:?}");
                    errored = true;
                    break;
                }
                proto::EngineStatus::Started => {
                    error!(
                        "Received unexpected engine `Started` message after engine had already \
                         started: {}",
                        msg.kind()
                    );
                    break;
                }
            }
        }
        debug!("Performing cleanup");
        engine_process
            .exit_and_cleanup()
            .await
            .wrap_err("Could not cleanup after finish")?;

        ensure!(!errored, "experiment had errors");

        Ok(())
    }
}

// TODO: cleanup section below

fn get_simple_experiment_config(
    base: &ExperimentRunBase,
    experiment_name: ExperimentName,
) -> Result<SimpleExperimentConfig> {
    let experiments_manifest = base
        .project_base
        .experiments_src
        .clone()
        .ok_or_else(|| report!("Experiment configuration not found: experiments.json"))?;
    let parsed = serde_json::from_str(&experiments_manifest)
        .wrap_err("Could not parse experiment manifest")?;
    let plan = create_experiment_plan(&parsed, &experiment_name)
        .wrap_err("Could not read experiment plan")?;

    let max_sims_in_parallel = parsed
        .get("max_sims_in_parallel")
        .map(|val| {
            val.as_u64().map(|val| val as usize).ok_or_else(|| {
                report!("max_sims_in_parallel in globals.json was set, but wasn't a valid integer")
            })
        })
        .transpose()?; // Extract and report the error for failed parsing

    let config = SimpleExperimentConfig {
        experiment_name,
        changed_properties: plan
            .inner
            .into_iter()
            .flat_map(|v| {
                v.fields
                    .into_iter()
                    .map(|(property_path, changed_value)| json!({ property_path: changed_value }))
            })
            .collect(),
        num_steps: plan.num_steps,
        max_sims_in_parallel,
    };
    Ok(config)
}

fn create_experiment_plan(
    experiments: &HashMap<String, SerdeValue>,
    experiment_name: &ExperimentName,
) -> Result<SimpleExperimentPlan> {
    let selected_experiment = experiments.get(experiment_name.as_str()).ok_or_else(|| {
        report!(
            "Expected experiments.json to contain the specified experiment definition for \
             experiment with name: {experiment_name}"
        )
    })?;
    let experiment_type = selected_experiment
        .get("type")
        .ok_or_else(|| report!("Expected experiment definition to contain an experiment type"))?
        .as_str()
        .ok_or_else(|| report!("Expected experiment definition type to have a string value"))?;
    match experiment_type {
        "group" => create_group_variant(selected_experiment, experiments),
        "multiparameter" => create_multiparameter_variant(selected_experiment, experiments),
        "optimization" => bail!("Not implemented for optimization experiment types"),
        _ => create_basic_variant(selected_experiment, experiment_type)
            .wrap_err("Could not parse basic variant"),
    }
}

fn create_multiparameter_variant(
    selected_experiment: &SerdeValue,
    experiments: &HashMap<String, SerdeValue>,
) -> Result<SimpleExperimentPlan> {
    #[derive(Serialize, Deserialize)]
    struct MultiparameterVariant {
        #[serde(rename = "type")]
        _type: String,
        steps: usize,
        runs: Vec<String>,
    }

    let var: MultiparameterVariant = serde_json::from_value(selected_experiment.clone())
        .wrap_err("Could not parse multiparameter variant")?;
    let subplans = var
        .runs
        .iter()
        .map(|run_name| {
            let selected = experiments
                .get(run_name)
                .ok_or_else(|| {
                    report!("Experiment plan does not define the specified experiment: {run_name}")
                })
                .wrap_err("Could not parse experiment file")?;
            create_basic_variant(selected, run_name).wrap_err("Could not parse basic variant")
        })
        .collect::<Result<Vec<SimpleExperimentPlan>>>()
        .wrap_err("Unable to create sub plans")?;

    let mut variant_list: Vec<ExperimentPlanEntry> = vec![];
    for (i, subplan) in subplans.into_iter().enumerate() {
        if i == 0 {
            variant_list = subplan.inner;
        } else {
            let mut new_variant_list: Vec<ExperimentPlanEntry> = vec![];
            for entry in subplan.inner.into_iter().map(|v| v.fields) {
                for existing_entry in &variant_list {
                    let mut merged = existing_entry.clone();
                    entry.iter().for_each(|(name, value)| {
                        merged.fields.insert(name.clone(), value.clone());
                    });
                    new_variant_list.push(merged);
                }
            }
            variant_list = new_variant_list;
        }
    }

    let mut plan = SimpleExperimentPlan::new(var.steps);
    plan.inner = variant_list;
    Ok(plan)
}

fn create_group_variant(
    selected_experiment: &SerdeValue,
    experiments: &HashMap<String, SerdeValue>,
) -> Result<SimpleExperimentPlan> {
    #[derive(Serialize, Deserialize)]
    struct GroupVariant {
        // TODO: move ALL variants to proto, experiment plan creation to simple exp controller def
        #[serde(rename = "type")]
        _type: String,
        steps: f64,
        runs: Vec<ExperimentName>,
    }
    let var: GroupVariant = serde_json::from_value(selected_experiment.clone())?;
    var.runs.iter().try_fold(
        SimpleExperimentPlan::new(var.steps as usize),
        |mut acc, name| {
            let variants = create_experiment_plan(experiments, name)
                .wrap_err("Could not read experiment plan")?;
            variants.inner.into_iter().for_each(|v| {
                acc.push(v);
            });
            Ok(acc)
        },
    )
}

fn create_basic_variant(
    selected_experiment: &SerdeValue,
    experiment_type: &str,
) -> Result<SimpleExperimentPlan> {
    match experiment_type {
        "monte-carlo" => create_monte_carlo_variant_plan(selected_experiment),
        "values" => create_value_variant_plan(selected_experiment),
        "linspace" => create_linspace_variant_plan(selected_experiment),
        "arange" => create_arange_variant_plan(selected_experiment),
        "meshgrid" => create_meshgrid_variant_plan(selected_experiment),
        _ => bail!("Unknown experiment type: {}", experiment_type),
    }
}

pub type Mapper = Box<dyn Fn(SerdeValue, usize) -> SerdeValue>;

fn create_variant_with_mapped_value(
    field: &str,
    items: &[SerdeValue],
    mapper: &Mapper,
    num_steps: usize,
) -> SimpleExperimentPlan {
    items.iter().enumerate().fold(
        SimpleExperimentPlan::new(num_steps),
        |mut acc, (index, val)| {
            let mapped_value = mapper(val.clone(), index);
            acc.push(HashMap::from([(field.to_string(), mapped_value)]).into());
            acc
        },
    )
}

fn create_monte_carlo_variant_plan(
    selected_experiment: &SerdeValue,
) -> Result<SimpleExperimentPlan> {
    #[derive(Serialize, Deserialize)]
    struct MonteCarloVariant {
        #[serde(rename = "type")]
        _type: String,
        steps: f64,
        field: String,
        samples: f64,
        distribution: String,
        mean: Option<f64>,
        std: Option<f64>,
        mu: Option<f64>,
        sigma: Option<f64>,
        rate: Option<f64>,
        alpha: Option<f64>,
        beta: Option<f64>,
        shape: Option<f64>,
        scale: Option<f64>,
    }

    // Needed trait objects of distributions, solution from:
    // https://users.rust-lang.org/t/vec-of-rand-distribution-trait-objects/58727/2
    pub trait DynDistribution<T> {
        fn sample_(&self, rng: &mut dyn RngCore) -> T;
    }

    impl<D, T> DynDistribution<T> for D
    where
        D: Distribution<T>,
    {
        fn sample_(&self, rng: &mut dyn RngCore) -> T {
            <Self as Distribution<T>>::sample(self, rng)
        }
    }

    impl<T> Distribution<T> for dyn DynDistribution<T> + '_ {
        fn sample<R: Rng + ?Sized>(&self, mut rng: &mut R) -> T {
            self.sample_(&mut rng)
        }
    }

    impl MonteCarloVariant {
        fn sample_distribution_fn(&self) -> Result<Mapper> {
            let distribution = match self.distribution.as_str() {
                "normal" => Box::new(
                    Normal::new(self.mean.unwrap_or(1.0), self.std.unwrap_or(1.0))
                        .wrap_err("Unable to create normal distribution")?,
                ) as Box<dyn DynDistribution<f64>>,
                "log-normal" => Box::new(
                    LogNormal::new(self.mu.unwrap_or(1.0), self.sigma.unwrap_or(1.0))
                        .wrap_err("Unable to create log-normal distribution")?,
                ),
                "poisson" => Box::new(
                    Poisson::new(self.rate.unwrap_or(1.0))
                        .wrap_err("Unable to create poisson distribution")?,
                ),
                "beta" => Box::new(
                    Beta::new(self.alpha.unwrap_or(1.0), self.beta.unwrap_or(1.0))
                        .wrap_err("Unable to create beta distribution")?,
                ),
                "gamma" => Box::new(
                    rand_distr::Gamma::new(self.shape.unwrap_or(1.0), self.scale.unwrap_or(1.0))
                        .wrap_err("Unable to create gamma distribution")?,
                ),
                _ => Box::new(
                    Normal::new(1.0, 1.0).wrap_err("Unable to create normal distribution")?,
                ),
            };
            Ok(Box::new(move |_, _| {
                let mut rng = rand::thread_rng();
                distribution.sample(&mut rng).into()
            }))
        }
    }

    let var: MonteCarloVariant = serde_json::from_value(selected_experiment.clone())?;
    let values: Vec<_> = (0..var.samples as usize).map(|_| 0.into()).collect();
    Ok(create_variant_with_mapped_value(
        &var.field,
        &values,
        &var.sample_distribution_fn()?,
        var.steps as usize,
    ))
}

fn create_value_variant_plan(selected_experiment: &SerdeValue) -> Result<SimpleExperimentPlan> {
    #[derive(Serialize, Deserialize)]
    struct ValueVariant {
        #[serde(rename = "type")]
        _type: String,
        steps: f64,
        field: String,
        values: Vec<SerdeValue>,
    }

    let var: ValueVariant = serde_json::from_value(selected_experiment.clone())
        .wrap_err("Could not parse value variant")?;
    let mapper: Mapper = Box::new(|val, _index| val);
    Ok(create_variant_with_mapped_value(
        &var.field,
        &var.values,
        &mapper,
        var.steps as usize,
    ))
}

fn create_linspace_variant_plan(selected_experiment: &SerdeValue) -> Result<SimpleExperimentPlan> {
    #[derive(Clone, Serialize, Deserialize, Debug)]
    struct LinspaceVariant {
        #[serde(rename = "type")]
        _type: String,
        steps: f64,
        field: String,
        samples: f64,
        start: f64,
        stop: f64,
    }
    let var: LinspaceVariant = serde_json::from_value(selected_experiment.clone())?;
    let values: Vec<_> = (0..var.samples as usize).map(|_| 0.into()).collect();

    let closure_var = var.clone();
    let mapper: Mapper = Box::new(move |_val, index| {
        let denominator = if closure_var.samples > 1.0 {
            (closure_var.samples - 1.0) as f64
        } else {
            1.0
        };
        let x = closure_var.start
            + (index as f64 * (closure_var.stop - closure_var.start)) / denominator;
        x.into()
    });

    Ok(create_variant_with_mapped_value(
        &var.field,
        &values,
        &mapper,
        var.steps as usize,
    ))
}

fn create_arange_variant_plan(selected_experiment: &SerdeValue) -> Result<SimpleExperimentPlan> {
    #[derive(Serialize, Deserialize)]
    struct ArangeVariant {
        #[serde(rename = "type")]
        _type: String,
        steps: f64,
        field: String,
        increment: f64,
        start: f64,
        stop: f64,
    }
    let var: ArangeVariant = serde_json::from_value(selected_experiment.clone())?;
    let mut values = vec![];
    let mut cur = var.start;
    while cur <= var.stop {
        values.push(cur.into());
        cur += var.increment;
    }
    let mapper: Mapper = Box::new(|val, _index| val);
    Ok(create_variant_with_mapped_value(
        &var.field,
        &values,
        &mapper,
        var.steps as usize,
    ))
}

fn create_meshgrid_variant_plan(selected_experiment: &SerdeValue) -> Result<SimpleExperimentPlan> {
    #[derive(Serialize, Deserialize)]
    struct MeshgridVariant {
        #[serde(rename = "type")]
        _type: String,
        steps: f64,
        x_field: String,
        y_field: String,
        x: [f64; 3],
        // [start, stop, num_samples]
        y: [f64; 3], // [start, stop, num_samples]
    }
    let var: MeshgridVariant = serde_json::from_value(selected_experiment.clone())?;

    let mut plan = SimpleExperimentPlan::new(var.steps as usize);
    let x_space = linspace(var.x[0], var.x[1], var.x[2] as usize);
    let y_space = linspace(var.y[0], var.y[1], var.y[2] as usize);

    for x_val in x_space {
        for y_val in &y_space {
            let entry = HashMap::from([
                (var.x_field.clone(), x_val.into()),
                (var.y_field.clone(), (*y_val).into()),
            ])
            .into();
            plan.push(entry);
        }
    }

    Ok(plan)
}

fn linspace(start: f64, stop: f64, num_samples: usize) -> Vec<f64> {
    let mut samples = vec![];
    let length = (stop - start) / (num_samples - 1) as f64;
    let mut index = start;
    while index <= stop {
        samples.push(start + length * index);
        index += length;
    }
    samples
}

#[derive(Clone, Debug)]
struct ExperimentPlanEntry {
    fields: HashMap<String, SerdeValue>,
}

impl From<HashMap<String, SerdeValue>> for ExperimentPlanEntry {
    fn from(fields: HashMap<String, SerdeValue>) -> Self {
        ExperimentPlanEntry { fields }
    }
}

#[derive(Clone)]
struct SimpleExperimentPlan {
    inner: Vec<ExperimentPlanEntry>,
    num_steps: usize,
}

impl SimpleExperimentPlan {
    pub fn new(num_steps: usize) -> SimpleExperimentPlan {
        SimpleExperimentPlan {
            inner: Vec::new(),
            num_steps,
        }
    }

    pub fn push(&mut self, value: ExperimentPlanEntry) {
        self.inner.push(value);
    }
}
