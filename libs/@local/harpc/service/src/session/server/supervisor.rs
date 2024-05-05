use alloc::sync::Arc;

use error_stack::{FutureExt as _, Result, ResultExt};
use futures::{FutureExt, StreamExt, TryFutureExt};
use scc::HashIndex;
use tokio::{
    select,
    sync::{mpsc, Semaphore},
};
use tokio_util::{sync::CancellationToken, task::TaskTracker};

use super::{session_id::SessionIdProducer, transaction::Transaction};
use crate::{
    session::{error::SessionError, server::connection::ConnectionTask},
    transport::TransportLayer,
};

pub(crate) enum Command {}

pub(crate) struct SupervisorTask {
    pub(crate) id: SessionIdProducer,
    pub(crate) transport: TransportLayer,

    pub(crate) active: Arc<Semaphore>,

    pub(crate) transactions: mpsc::Sender<Transaction>,
}

impl SupervisorTask {
    #[allow(clippy::integer_division_remainder_used)]
    pub(crate) async fn run(mut self, cancel: CancellationToken) -> Result<(), SessionError> {
        let mut listen = self.transport.listen().await.change_context(SessionError)?;

        let tracker = TaskTracker::new();

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
                        .map(|connection| {
                            connection.map(|(peer, sink, stream)| (permit, peer, sink, stream))
                        })
                        .map(Ok)
                });

            let connection = select! {
                connection = next => connection,
                () = cancel.cancelled() => {
                    break;
                }
            };

            match connection {
                Ok(Some((permit, peer, sink, stream))) => {
                    let cancel = cancel.child_token();

                    let task = ConnectionTask {
                        session: self.id.produce(),
                        transactions: Arc::new(HashIndex::new()),
                        peer,
                        permit,
                        tx_transaction: self.transactions.clone(),
                    };

                    tracker.spawn(task.run(cancel, sink, stream));
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
