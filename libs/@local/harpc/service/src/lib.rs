#![feature(
    never_type,
    trait_alias,
    type_alias_impl_trait,
    impl_trait_in_assoc_type
)]

extern crate alloc;

pub mod codec;
pub mod config;
pub mod session;
mod stream;
pub mod transport;

// TODO: payload size layer, timeout layer
// ^ should these be composable via a trait? or nah. Honestly doesn't really matter.
// ^ these should not part of this crate, but rather the typed RPC layer crate
