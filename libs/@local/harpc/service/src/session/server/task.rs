use alloc::sync::Arc;

use error_stack::{FutureExt as _, Result, ResultExt};
use futures::{FutureExt, StreamExt, TryFutureExt};
use tokio::{
    select,
    sync::{broadcast, mpsc, Semaphore},
};
use tokio_util::{sync::CancellationToken, task::TaskTracker};

use super::{
    connection::TransactionCollection, session_id::SessionIdProducer, transaction::Transaction,
    SessionConfig, SessionEvent,
};
use crate::{
    codec::ErrorEncoder,
    session::{error::SessionError, server::connection::ConnectionTask},
    transport::{connection::IncomingConnection, TransportLayer},
};

pub(crate) struct Task<E> {
    pub(crate) id: SessionIdProducer,
    pub(crate) transport: TransportLayer,

    pub(crate) config: SessionConfig,

    pub(crate) active: Arc<Semaphore>,

    pub(crate) output: mpsc::Sender<Transaction>,
    pub(crate) events: broadcast::Sender<SessionEvent>,
    pub(crate) encoder: Arc<E>,
}

impl<E> Task<E>
where
    E: ErrorEncoder + Send + Sync + 'static,
{
    #[allow(clippy::integer_division_remainder_used)]
    pub(crate) async fn run(
        mut self,
        tasks: TaskTracker,
        cancel: CancellationToken,
    ) -> Result<(), SessionError> {
        let mut listen = self.transport.listen().await.change_context(SessionError)?;

        loop {
            // first try to acquire a permit, if we can't, we can't accept new connections,
            // then we try to accept a new connection, this way we're able to still apply
            // backpressure
            let next = Arc::clone(&self.active)
                .acquire_owned()
                .change_context(SessionError)
                .and_then(|permit| {
                    listen
                        .next()
                        .map(|connection| connection.map(|connection| (permit, connection)))
                        .map(Ok)
                });

            let connection = select! {
                connection = next => connection,
                () = cancel.cancelled() => {
                    break;
                }
            };

            match connection {
                Ok(Some((
                    permit,
                    IncomingConnection {
                        peer_id,
                        sink,
                        stream,
                    },
                ))) => {
                    let cancel = cancel.child_token();

                    let task = ConnectionTask {
                        peer: peer_id,
                        session: self.id.produce(),
                        config: self.config,
                        active: TransactionCollection::new(self.config, cancel.clone()),
                        output: self.output.clone(),
                        events: self.events.clone(),
                        encoder: Arc::clone(&self.encoder),
                        _permit: permit,
                    };

                    tasks.spawn(task.run(sink, stream, tasks.clone(), cancel));
                }
                Ok(None) => {
                    break;
                }
                Err(_) => {
                    // semaphore has been closed, this means we can no longer accept new connections
                    break;
                }
            }
        }

        Ok(())
    }
}
