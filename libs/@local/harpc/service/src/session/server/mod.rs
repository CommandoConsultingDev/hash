mod config;
mod connection;
mod session_id;
mod task;
mod transaction;
mod write;

use alloc::sync::Arc;

use error_stack::{Result, ResultExt};
use futures::Stream;
use libp2p::Multiaddr;
use tokio::sync::{broadcast, mpsc, Semaphore};
use tokio_util::{sync::CancellationToken, task::TaskTracker};

pub use self::{config::SessionConfig, session_id::SessionId, transaction::Transaction};
use self::{session_id::SessionIdProducer, task::Task};
use super::error::SessionError;
use crate::{codec::ErrorEncoder, stream::ReceiverStreamCancel, transport::TransportLayer};

// TODO: encoding and decoding layer(?)
// TODO: timeout layer - needs encoding layer (for error handling), and IPC to cancel a specific
// request in a session

#[derive(Debug, Copy, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum SessionEvent {
    SessionDropped { id: SessionId },
}

/// Session Layer
///
/// The session layer is responsible for accepting incoming connections, and splitting them up into
/// dedicated sessions, these sessions are then used to form transactions.
pub struct SessionLayer<E> {
    config: SessionConfig,
    encoder: Arc<E>,

    events: broadcast::Sender<SessionEvent>,

    // TODO: IPC (do we need it tho?)
    transport: TransportLayer,

    tasks: TaskTracker,
}

impl<E> SessionLayer<E>
where
    E: ErrorEncoder + Send + Sync + 'static,
{
    pub fn new(config: SessionConfig, transport: TransportLayer, encoder: E) -> Self {
        let tasks = transport.tasks().clone();

        let (events, _) = broadcast::channel(config.event_buffer_size.get());

        Self {
            config,
            encoder: Arc::new(encoder),

            events,

            transport,

            tasks,
        }
    }

    #[must_use]
    pub const fn tasks(&self) -> &TaskTracker {
        &self.tasks
    }

    #[must_use]
    pub fn events(&self) -> broadcast::Receiver<SessionEvent> {
        self.events.subscribe()
    }

    /// Listen for incoming connections on the given address.
    ///
    /// # Errors
    ///
    /// Returns an error if the transport layer fails to listen on the given address.
    pub async fn listen(
        self,
        address: Multiaddr,
    ) -> Result<impl Stream<Item = Transaction> + Send + Sync + 'static, SessionError> {
        self.transport
            .listen_on(address)
            .await
            .change_context(SessionError)?;

        let (output, rx) = mpsc::channel(self.config.transaction_buffer_size);

        let task = Task {
            id: SessionIdProducer::new(),
            transport: self.transport,
            config: self.config,
            active: Arc::new(Semaphore::new(self.config.concurrent_connection_limit)),
            output,
            events: self.events.clone(),
            encoder: self.encoder,
        };

        let cancel = CancellationToken::new();

        self.tasks
            .spawn(task.run(self.tasks.clone(), cancel.clone()));

        Ok(ReceiverStreamCancel::new(rx, cancel.drop_guard()))
    }
}
