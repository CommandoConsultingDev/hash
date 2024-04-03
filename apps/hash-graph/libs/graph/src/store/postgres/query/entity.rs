use std::iter::once;

use crate::{
    knowledge::EntityQueryPath,
    store::postgres::query::{
        table::{
            Column, EntityEditions, EntityEmbeddings, EntityHasLeftEntity, EntityHasRightEntity,
            EntityIds, EntityIsOfTypeIds, EntityProperties, EntityTemporalMetadata, JsonField,
            ReferenceTable, Relation,
        },
        PostgresQueryPath,
    },
    subgraph::edges::{EdgeDirection, KnowledgeGraphEdgeKind, SharedEdgeKind},
};

impl PostgresQueryPath for EntityQueryPath<'_> {
    fn relations(&self) -> Vec<Relation> {
        match self {
            Self::Uuid
            | Self::OwnedById
            | Self::EditionId
            | Self::DecisionTime
            | Self::TransactionTime
            | Self::DraftId => vec![],
            Self::CreatedById
            | Self::CreatedAtTransactionTime
            | Self::CreatedAtDecisionTime
            | Self::FirstNonDraftCreatedAtTransactionTime
            | Self::FirstNonDraftCreatedAtDecisionTime => {
                vec![Relation::EntityIds]
            }
            Self::Embedding => vec![Relation::EntityEmbeddings],
            Self::LeftEntityConfidence => vec![Relation::LeftEntity],
            Self::RightEntityConfidence => vec![Relation::RightEntity],
            Self::PropertyPaths | Self::PropertyConfidences => vec![Relation::EntityProperties],
            Self::Properties(_)
            | Self::EditionCreatedById
            | Self::Archived
            | Self::EntityConfidence => {
                vec![Relation::EntityEditions]
            }
            Self::TypeBaseUrls | Self::TypeVersions => vec![Relation::EntityIsOfTypes],
            Self::EntityTypeEdge {
                edge_kind: SharedEdgeKind::IsOfType,
                path,
                inheritance_depth,
            } => once(Relation::Reference {
                table: ReferenceTable::EntityIsOfType {
                    inheritance_depth: *inheritance_depth,
                },
                direction: EdgeDirection::Outgoing,
            })
            .chain(path.relations())
            .collect(),
            Self::EntityEdge {
                edge_kind: KnowledgeGraphEdgeKind::HasLeftEntity,
                path,
                direction: EdgeDirection::Outgoing,
            } if **path == EntityQueryPath::Uuid || **path == EntityQueryPath::OwnedById => {
                vec![Relation::LeftEntity]
            }
            Self::EntityEdge {
                edge_kind: KnowledgeGraphEdgeKind::HasLeftEntity,
                path,
                direction,
            } => once(Relation::Reference {
                table: ReferenceTable::EntityHasLeftEntity,
                direction: *direction,
            })
            .chain(path.relations())
            .collect(),
            Self::EntityEdge {
                edge_kind: KnowledgeGraphEdgeKind::HasRightEntity,
                path,
                direction: EdgeDirection::Outgoing,
            } if **path == EntityQueryPath::Uuid || **path == EntityQueryPath::OwnedById => {
                vec![Relation::RightEntity]
            }
            Self::EntityEdge {
                edge_kind: KnowledgeGraphEdgeKind::HasRightEntity,
                path,
                direction,
            } => once(Relation::Reference {
                table: ReferenceTable::EntityHasRightEntity,
                direction: *direction,
            })
            .chain(path.relations())
            .collect(),
        }
    }

    fn terminating_column(&self) -> Column {
        match self {
            Self::OwnedById => Column::EntityTemporalMetadata(EntityTemporalMetadata::WebId),
            Self::Uuid => Column::EntityTemporalMetadata(EntityTemporalMetadata::EntityUuid),
            Self::DraftId => Column::EntityTemporalMetadata(EntityTemporalMetadata::DraftId),
            Self::EditionId => Column::EntityTemporalMetadata(EntityTemporalMetadata::EditionId),
            Self::DecisionTime => {
                Column::EntityTemporalMetadata(EntityTemporalMetadata::DecisionTime)
            }
            Self::TransactionTime => {
                Column::EntityTemporalMetadata(EntityTemporalMetadata::TransactionTime)
            }
            Self::Archived => Column::EntityEditions(EntityEditions::Archived),
            Self::EditionCreatedById => Column::EntityEditions(EntityEditions::EditionCreatedById),
            Self::Embedding => Column::EntityEmbeddings(EntityEmbeddings::Embedding),
            Self::CreatedById => Column::EntityIds(EntityIds::CreatedById),
            Self::TypeBaseUrls => Column::EntityIsOfTypeIds(EntityIsOfTypeIds::BaseUrls),
            Self::TypeVersions => Column::EntityIsOfTypeIds(EntityIsOfTypeIds::Versions),
            Self::CreatedAtDecisionTime => Column::EntityIds(EntityIds::CreatedAtDecisionTime),
            Self::CreatedAtTransactionTime => {
                Column::EntityIds(EntityIds::CreatedAtTransactionTime)
            }
            Self::FirstNonDraftCreatedAtDecisionTime => {
                Column::EntityIds(EntityIds::FirstNonDraftCreatedAtDecisionTime)
            }
            Self::FirstNonDraftCreatedAtTransactionTime => {
                Column::EntityIds(EntityIds::FirstNonDraftCreatedAtTransactionTime)
            }
            Self::EntityTypeEdge { path, .. } => path.terminating_column(),
            Self::EntityEdge {
                edge_kind: KnowledgeGraphEdgeKind::HasLeftEntity,
                path,
                direction: EdgeDirection::Outgoing,
            } if **path == EntityQueryPath::Uuid => {
                Column::EntityHasLeftEntity(EntityHasLeftEntity::LeftEntityUuid)
            }
            Self::EntityEdge {
                edge_kind: KnowledgeGraphEdgeKind::HasLeftEntity,
                path,
                direction: EdgeDirection::Outgoing,
            } if **path == EntityQueryPath::OwnedById => {
                Column::EntityHasLeftEntity(EntityHasLeftEntity::LeftEntityWebId)
            }
            Self::EntityEdge {
                edge_kind: KnowledgeGraphEdgeKind::HasRightEntity,
                path,
                direction: EdgeDirection::Outgoing,
            } if **path == EntityQueryPath::Uuid => {
                Column::EntityHasRightEntity(EntityHasRightEntity::RightEntityUuid)
            }
            Self::EntityEdge {
                edge_kind: KnowledgeGraphEdgeKind::HasRightEntity,
                path,
                direction: EdgeDirection::Outgoing,
            } if **path == EntityQueryPath::OwnedById => {
                Column::EntityHasRightEntity(EntityHasRightEntity::RightEntityWebId)
            }
            Self::EntityEdge { path, .. } => path.terminating_column(),
            Self::Properties(path) => path.as_ref().map_or(
                Column::EntityEditions(EntityEditions::Properties(None)),
                |path| {
                    Column::EntityEditions(EntityEditions::Properties(Some(JsonField::JsonPath(
                        path,
                    ))))
                },
            ),
            Self::EntityConfidence => Column::EntityEditions(EntityEditions::Confidence),
            Self::LeftEntityConfidence => {
                Column::EntityHasLeftEntity(EntityHasLeftEntity::Confidence)
            }
            Self::RightEntityConfidence => {
                Column::EntityHasRightEntity(EntityHasRightEntity::Confidence)
            }
            Self::PropertyPaths => Column::EntityProperties(EntityProperties::PropertyPaths),
            Self::PropertyConfidences => Column::EntityProperties(EntityProperties::Confidences),
        }
    }
}
