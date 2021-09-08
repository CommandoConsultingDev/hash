import { gql } from "apollo-server-express";

export const entityTypeTypedef = gql`
  extend type Query {
    """
    Get all EntityTypes belonging to an account
    """
    getAccountEntityTypes(accountId: ID!): [EntityType!]!
  }

  extend type Mutation {
    """
    Create an entity type
    """
    createEntityType(
      accountId: ID!
      """
      The name for the type. Must be unique in the given account.
      """
      name: String!
      """
      A description for the type.
      """
      description: String
      """
      The schema definition for the entity type, in JSON Schema.
      """
      schema: JSONObject
    ): EntityType!
  }

  enum SystemTypeName {
    Block
    EntityType
    Org
    Page
    Text
    User
  }

  """
  A schema describing and validating a specific type of entity
  """
  type EntityType implements Entity {
    """
    The shape of the entity, expressed as a JSON Schema
    https://json-schema.org/
    """
    properties: JSONObject!

    # ENTITY INTERFACE FIELDS BEGIN #
    """
    The id of the entity - alias of 'entityId'
    """
    id: ID!
    """
    The id of the entity - alias of 'id'
    """
    entityId: ID!
    """
    The specific version if of the entity
    """
    entityVersionId: ID!
    """
    The id of the account this entity belongs to
    """
    accountId: ID!
    """
    The date the entity was created
    """
    createdAt: Date!
    """
    The date this entity version was created.
    """
    entityVersionCreatedAt: Date!
    """
    The user who created the entity
    """
    createdById: ID!
    """
    The date the entity was last updated
    """
    updatedAt: Date!
    """
    The visibility level of the entity
    """
    visibility: Visibility!
    """
    The fixed id of the type this entity is of
    """
    entityTypeId: ID!
    """
    The id of the specific version of the type this entity is of
    """
    entityTypeVersionId: ID!
    """
    The name of the entity type this belongs to.
    N.B. Type names are unique by account - not globally.
    """
    entityTypeName: String!
    """
    The full entityType definition
    """
    entityType: EntityType!
    """
    The version timeline of the entity.
    """
    history: [EntityVersion!]
    """
    The metadata ID of the entity. This is shared across all versions of the same entity.
    """
    metadataId: ID!
    # ENTITY INTERFACE FIELDS END #
  }
`;
