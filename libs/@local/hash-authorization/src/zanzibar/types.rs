//! General types and traits used throughout the Zanzibar authorization system.

pub use self::{
    object::{Object, ObjectFilter},
    subject::{Subject, SubjectFilter},
};

mod object;
mod subject;

use core::fmt;
use std::{borrow::Cow, fmt::Display};

use serde::{de::DeserializeOwned, Deserialize, Serialize};

pub struct Filter<'f, O, R, S> {
    object: Option<&'f O>,
    affiliation: Option<&'f R>,
    subject: Option<&'f S>,
}

impl Filter<'_, !, !, !> {
    pub const fn new() -> Self {
        Self {
            object: None,
            affiliation: None,
            subject: None,
        }
    }
}

impl<'f, R, S> Filter<'f, !, R, S> {
    pub const fn with_object<O: ObjectFilter>(self, object: &'f O) -> Filter<O, R, S> {
        Filter {
            object: Some(object),
            affiliation: self.affiliation,
            subject: self.subject,
        }
    }
}

impl<'f, O, S> Filter<'f, O, !, S>
where
    O: ObjectFilter,
{
    pub const fn with_relation<R: RelationFilter<O>>(self, relation: &'f R) -> Filter<O, R, S> {
        Filter {
            object: self.object,
            affiliation: Some(relation),
            subject: self.subject,
        }
    }

    pub const fn with_permission<R: Permission<O>>(self, permission: &'f R) -> Filter<O, R, S> {
        Filter {
            object: self.object,
            affiliation: Some(permission),
            subject: self.subject,
        }
    }
}

impl<'f, O, R> Filter<'f, O, R, !> {
    pub const fn with_subject<S: SubjectFilter>(self, subject: &'f S) -> Filter<O, R, S> {
        Filter {
            object: self.object,
            affiliation: self.affiliation,
            subject: Some(subject),
        }
    }
}

impl<O, R, S> Filter<'_, O, R, S>
where
    O: ObjectFilter,
{
    #[inline]
    #[must_use]
    pub const fn object(&self) -> Option<&O> {
        self.object
    }
}

impl<O, R, S> Filter<'_, O, R, S>
where
    O: ObjectFilter,
    R: AffiliationFilter<O>,
{
    #[inline]
    #[must_use]
    pub const fn affiliation(&self) -> Option<&R> {
        self.affiliation
    }
}

impl<O, R, S> Filter<'_, O, R, S>
where
    O: ObjectFilter,
    R: Permission<O>,
{
    #[inline]
    #[must_use]
    pub const fn permission(&self) -> Option<&R> {
        self.affiliation()
    }
}

impl<O, R, S> Filter<'_, O, R, S>
where
    O: ObjectFilter,
    R: RelationFilter<O>,
{
    #[inline]
    #[must_use]
    pub const fn relation(&self) -> Option<&R> {
        self.affiliation()
    }
}

impl<O, R, S> Filter<'_, O, R, S>
where
    S: SubjectFilter,
{
    #[inline]
    #[must_use]
    pub const fn subject(&self) -> Option<&S> {
        self.subject
    }
}

/// The relation or permission of a [`Resource`] to another [`Resource`].
pub trait AffiliationFilter<R: ObjectFilter + ?Sized>: Serialize + Display + Send + Sync {}

/// The relation or permission of a [`Resource`] to another [`Resource`].
pub trait Affiliation<R: Object + ?Sized>: AffiliationFilter<R> {}

/// A computed set of [`Resource`]s for another particular [`Resource`].
pub trait Permission<R: ObjectFilter + ?Sized>: AffiliationFilter<R> {}

/// Encapsulates the relationship between two [`Resource`]s.
pub trait RelationFilter<R: ObjectFilter + ?Sized>: AffiliationFilter<R> {}

/// Encapsulates the relationship between two [`Resource`]s.
pub trait Relation<R: Object + ?Sized>: Affiliation<R> + RelationFilter<R> {}

// impl<O> ObjectFilter for O
// where
//     O: Object,
// {
//     type Id = O::Id;
//     type Namespace = O::Namespace;
//
//     fn namespace(&self) -> &Self::Namespace {
//         self.namespace()
//     }
//
//     fn id(&self) -> &Self::Id {
//         self.id()
//     }
// }

impl<O: ObjectFilter> AffiliationFilter<O> for ! {}
impl<O: Object> Affiliation<O> for ! {}
impl<O: ObjectFilter> Permission<O> for ! {}
impl<O: ObjectFilter> RelationFilter<O> for ! {}
impl<O: Object> Relation<O> for ! {}

pub trait Relationship: Sized + Send {
    type Error: Display;
    type Object: Object;
    type Relation: Affiliation<Self::Object>;
    type Subject: Subject;

    fn from_tuple(
        object: Self::Object,
        relation: Self::Relation,
        subject: Self::Subject,
    ) -> Result<Self, Self::Error>;

    fn as_tuple(&self) -> (&Self::Object, &Self::Relation, &Self::Subject);

    /// Returns the underlying [`Object`] of this `Relationship`.
    fn object(&self) -> &Self::Object {
        self.as_tuple().0
    }

    /// Returns the [`Relation`] of this `Relationship`.
    fn relation(&self) -> &Self::Relation {
        self.as_tuple().1
    }

    /// Returns the [`Subject`] of this `Relationship`.
    fn subject(&self) -> &Self::Subject {
        self.as_tuple().2
    }
}

impl<O, R, S> Relationship for (O, R, S)
where
    O: Object,
    R: Affiliation<O>,
    S: Subject,
{
    type Error = !;
    type Object = O;
    type Relation = R;
    type Subject = S;

    fn from_tuple(
        object: Self::Object,
        relation: Self::Relation,
        subject: Self::Subject,
    ) -> Result<Self, Self::Error> {
        Ok((object, relation, subject))
    }

    fn as_tuple(&self) -> (&Self::Object, &Self::Relation, &Self::Subject) {
        (&self.0, &self.1, &self.2)
    }
}

// impl<O, R, S, SR> Relationship for (O, R, S, SR)
// where
//     O: Object,
//     R: Affiliation<O>,
//     S: Object,
//     SR: Affiliation<S>,
// {
//     type Error = !;
//     type Object = O;
//     type Relation = R;
//     type Subject = (S, Option<SR>);
//
//     fn from_tuple(
//         object: Self::Object,
//         relation: Self::Relation,
//         subject: Self::Subject,
//     ) -> Result<Self, Self::Error> { Ok((object, relation, subject))
//     }
//
//     fn as_tuple(&self) -> (&Self::Object, &Self::Relation, &Self::Subject) {
//         (&self.0, &self.1, &self.2)
//     }
// }

/// Represent a unique entity that is being modelled.
///
/// `Resource`s are composed of a namespace and an unique identifier and often displayed as those
/// two values separated by a colon.
pub trait Resource {
    /// The unique identifier for this `Resource`.
    type Id: Serialize + Display;

    /// Returns the namespace for this `Resource`.
    fn namespace() -> &'static str;

    /// Returns the unique identifier for this `Resource`.
    fn id(&self) -> Self::Id;
}

/// An untyped [`Tuple`] that only holds it's string representation.
///
/// This is useful for when the tuple types are not known at compile-time, e.g. when parsing a
/// [`Tuple`] from a string.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct UntypedTuple<'t> {
    pub object_namespace: Cow<'t, str>,
    pub object_id: Cow<'t, str>,
    pub affiliation: Cow<'t, str>,
    pub user_namespace: Cow<'t, str>,
    pub user_id: Cow<'t, str>,
    pub user_set: Option<Cow<'t, str>>,
}

impl UntypedTuple<'_> {
    #[must_use]
    pub fn into_owned(self) -> UntypedTuple<'static> {
        UntypedTuple {
            object_namespace: Cow::Owned(self.object_namespace.into_owned()),
            object_id: Cow::Owned(self.object_id.into_owned()),
            affiliation: Cow::Owned(self.affiliation.into_owned()),
            user_namespace: Cow::Owned(self.user_namespace.into_owned()),
            user_id: Cow::Owned(self.user_id.into_owned()),
            user_set: self.user_set.map(|cow| Cow::Owned(cow.into_owned())),
        }
    }
}

impl fmt::Display for UntypedTuple<'_> {
    fn fmt(&self, fmt: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            fmt,
            "{}:{}#{}@{}:{}",
            self.object_namespace,
            self.object_id,
            self.affiliation,
            self.user_namespace,
            self.user_id
        )?;
        if let Some(affiliation) = &self.user_set {
            write!(fmt, "#{affiliation}")?;
        }
        Ok(())
    }
}

// impl<'t> UntypedTuple<'t> {
//     #[must_use]
//     pub fn from_tuple<T: Tuple>(tuple: &'t T) -> Self {
//         Self {
//             object_namespace: Cow::Owned(tuple.object_namespace().to_string()),
//             object_id: Cow::Owned(tuple.object_id().to_string()),
//             affiliation: Cow::Owned(tuple.affiliation().to_string()),
//             user_namespace: Cow::Owned(tuple.user_namespace().to_string()),
//             user_id: Cow::Owned(tuple.user_id().to_string()),
//             user_set: tuple
//                 .user_set()
//                 .map(|user_set| Cow::Owned(user_set.to_string())),
//         }
//     }
// }

/// Provide causality metadata between Write and Check requests.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Zookie<'t>(Cow<'t, str>);

impl Zookie<'_> {
    pub(crate) const fn empty() -> Self {
        Self(Cow::Borrowed(""))
    }
}

/// Specifies the desired consistency level on a per-request basis.
///
/// This allows for the API consumers dynamically trade-off less fresh data for more performance
/// when possible.
#[derive(Debug, Copy, Clone)]
pub enum Consistency<'z> {
    /// Attempts to minimize the latency of the API call, using whatever caches are available.
    ///
    /// > ## Warning
    /// >
    /// > If used exclusively, this can lead to a window of time where the New Enemy Problem can
    /// > occur.
    MinimalLatency,
    /// Ensures that all data used for computing the response is at least as fresh as the
    /// point-in-time specified in the [`Zookie`].
    ///
    /// If newer information is available, it will be used.
    AtLeastAsFresh(&'z Zookie<'z>),
    /// Ensures that all data used for computing the response is that found at the exact
    /// point-in-time specified in the [`Zookie`].
    ///
    /// If the snapshot is not available, an error will be raised.
    AtExactSnapshot(&'z Zookie<'z>),
    /// Ensure that all data used is fully consistent with the latest data available within the
    /// SpiceDB datastore.
    ///
    /// Note that the snapshot used will be loaded at the beginning of the API call, and that new
    /// data written after the API starts executing will be ignored.
    ///
    /// > ## Warning
    /// >
    /// > Use of `FullyConsistent` means little caching will be available, which means performance
    /// > will suffer. Only use if a [`Zookie`] is not available or absolutely latest information
    /// > is required.
    FullyConsistent,
}
