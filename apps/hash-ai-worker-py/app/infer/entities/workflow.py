"""Workflow for inferring entities from the provided text input."""

import asyncio
from datetime import timedelta
from typing import TYPE_CHECKING

from temporalio import workflow

if TYPE_CHECKING:
    from graph_types.base import EntityType

with workflow.unsafe.imports_passed_through():
    from graph_types import EntityTypeReference
    from pydantic import ValidationError
    from pydantic_core import ErrorDetails

    from app._status import Status, StatusCode, StatusError
    from app.ontology.activity import GraphApiActivities

    from . import (
        EntityValidation,
        InferEntitiesActivityParameter,
        InferEntitiesWorkflowParameter,
        ProposedEntity,
    )

__all__ = [
    "InferEntitiesWorkflow",
]


@workflow.defn(name="inferEntities")
class InferEntitiesWorkflow:
    """Infers entities of the specified type(s) from the provided text input."""

    @workflow.run
    async def infer_entities(
        self,
        params: InferEntitiesWorkflowParameter,
    ) -> Status[ProposedEntity | ErrorDetails]:
        """Infer entities from the provided text input."""
        try:
            entity_types: dict[str, type[EntityType]] = {
                entity_type.info.identifier: entity_type
                for entity_type in await asyncio.gather(
                    *[
                        EntityTypeReference(
                            **{"$ref": entity_type_id},
                        ).create_model(
                            actor_id=params.authentication.actor_id,
                            graph=GraphApiActivities(
                                start_to_close_timeout=timedelta(seconds=15),
                                validate_required=params.validation
                                == EntityValidation.full,
                            ),
                        )
                        for entity_type_id in params.entity_type_ids
                    ],
                )
            }
        except StatusError as error:
            return error.status

        # TODO: Figure out how to pass `infer_entities` as function to gain type safety.
        #   https://linear.app/hash/issue/H-875
        # from app.infer.entities.activity import infer_entities
        status = Status(
            **await workflow.execute_activity(
                "inferEntities",
                InferEntitiesActivityParameter(
                    textInput=params.text_input,
                    entityTypes=[
                        entity_types[entity_type_id].model_json_schema(by_alias=True)
                        for entity_type_id in entity_types
                    ],
                    model=params.model,
                    maxTokens=params.max_tokens,
                    allowEmptyResults=params.allow_empty_results,
                    validation=params.validation,
                ),
                start_to_close_timeout=timedelta(minutes=1),
            ),
        )
        if status.code != StatusCode.OK:
            return status

        # TODO: Properly decode arguments so we don't need to cast them manually
        #   https://linear.app/hash/issue/H-875
        proposed_entities = [
            ProposedEntity(**entity) for entity in status.into_contents()
        ]

        # TODO: Figure out what we want to do with invalid entities.
        #   https://linear.app/hash/issue/H-878
        for proposed_entity in proposed_entities:
            try:
                if params.validation != EntityValidation.none:
                    proposed_entity.validate_entity_type(
                        entity_types[proposed_entity.entity_type_id],
                    )
            except ValidationError as error:
                return Status(
                    code=StatusCode.INVALID_ARGUMENT,
                    message=(
                        "Invalid proposed entity for entity type"
                        f" `{proposed_entity.entity_type_id}`"
                    ),
                    contents=error.errors(),
                )
            except KeyError:
                return Status(
                    code=StatusCode.INVALID_ARGUMENT,
                    message=(
                        "Invalid proposed entity type id"
                        f" `{proposed_entity.entity_type_id}`"
                    ),
                )
        return status
