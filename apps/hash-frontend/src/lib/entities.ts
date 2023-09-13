import { EntityPropertyValue } from "@blockprotocol/graph";
import { simplifyProperties } from "@local/hash-isomorphic-utils/simplify-properties";
import {
  Entity,
  EntityRootType,
  EntityTypeWithMetadata,
  extractEntityUuidFromEntityId,
  Subgraph,
} from "@local/hash-subgraph";
import {
  getEntityTypeAndParentsById,
  getRoots,
} from "@local/hash-subgraph/stdlib";

const getLabelPropertyValue = (
  entityToLabel: Entity,
  entityType: EntityTypeWithMetadata,
) => {
  if (entityType.metadata.custom.labelProperty) {
    const label =
      entityToLabel.properties[entityType.metadata.custom.labelProperty];

    if (label) {
      return label.toString();
    }
  }
};

const getFallbackLabel = ({
  entityType,
  entity,
}: {
  entityType?: EntityTypeWithMetadata;
  entity: Entity;
}) => {
  // fallback to the entity type and a few characters of the entityUuid
  const entityId = entity.metadata.recordId.entityId;

  const entityTypeName = entityType?.schema.title ?? "Entity";

  return `${entityTypeName}-${extractEntityUuidFromEntityId(entityId).slice(
    0,
    5,
  )}`;
};

/**
 * Generate a display label for an entity
 * Prefers the BP-specified labelProperty if it exists.
 * @see https://blockprotocol.org/docs/spec/graph-service-specification#json-schema-extensions
 */
export const generateEntityLabel = (
  entitySubgraph: Subgraph<EntityRootType>,
  entity?: Entity,
): string => {
  const entityToLabel: Entity = entity ?? getRoots(entitySubgraph)[0]!;

  const entityTypeAndAncestors = getEntityTypeAndParentsById(
    entitySubgraph,
    entityToLabel.metadata.entityTypeId,
  );

  const entityType = entityTypeAndAncestors[0];

  const entityTypesToCheck = entityType ? [entityType] : [];

  /**
   * Return any truthy value for a property which is set as the labelProperty for the entity's type,
   * or any of its ancestors, using a breadth-first search in the inheritance tree starting from the entity's own type.
   */
  for (let i = 0; i < entityTypesToCheck.length; i++) {
    const typeToCheck = entityTypesToCheck[i]!;

    const label = getLabelPropertyValue(entityToLabel, typeToCheck);

    if (label) {
      return label;
    }

    entityTypesToCheck.push(
      ...entityTypeAndAncestors.filter(
        (type) =>
          typeToCheck.schema.allOf?.find(
            ({ $ref }) => $ref === type.schema.$id,
          ),
      ),
    );
  }

  const simplifiedProperties = simplifyProperties(
    entityToLabel.properties,
  ) as Record<string, EntityPropertyValue>;

  // fallback to some likely display name properties
  const options = [
    "name",
    "preferredName",
    "displayName",
    "title",
    "organizationName",
    "shortname",
    "fileName",
    "originalFileName",
  ];

  for (const option of options) {
    if (
      simplifiedProperties[option] &&
      typeof simplifiedProperties[option] === "string"
    ) {
      return simplifiedProperties[option] as string;
    }
  }

  return getFallbackLabel({ entityType, entity: entityToLabel });
};
