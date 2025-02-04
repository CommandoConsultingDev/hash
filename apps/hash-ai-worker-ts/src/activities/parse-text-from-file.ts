import type { VersionedUrl } from "@blockprotocol/type-system";
import type { GraphApi } from "@local/hash-graph-client";
import { systemEntityTypes } from "@local/hash-isomorphic-utils/ontology-type-ids";
import type { ParseTextFromFileParams } from "@local/hash-isomorphic-utils/parse-text-from-file-types";
import type { DOCXDocumentProperties } from "@local/hash-isomorphic-utils/system-types/docxdocument";
import officeParser from "officeparser";

import { fetchFileFromUrl } from "./shared/fetch-file-from-url";

type TextParsingFunction = (fileBuffer: Buffer) => Promise<string>;

const officeParserTextParsingFunction: TextParsingFunction = async (
  fileBuffer,
) => {
  const text = await officeParser.parseOfficeAsync(fileBuffer);

  return text;
};

const fileEntityTypeToParsingFunction: Record<
  VersionedUrl,
  TextParsingFunction
> = {
  [systemEntityTypes.docxDocument.entityTypeId]:
    officeParserTextParsingFunction,
  [systemEntityTypes.pdfDocument.entityTypeId]: officeParserTextParsingFunction,
  [systemEntityTypes.pptxPresentation.entityTypeId]:
    officeParserTextParsingFunction,
};

export const parseTextFromFile = async (
  context: { graphApiClient: GraphApi },
  params: ParseTextFromFileParams,
) => {
  const { graphApiClient } = context;

  const { presignedFileDownloadUrl, fileEntity, webMachineActorId } = params;

  const fileBuffer = await fetchFileFromUrl(presignedFileDownloadUrl);

  const textParsingFunction =
    fileEntityTypeToParsingFunction[fileEntity.metadata.entityTypeId];

  if (textParsingFunction) {
    const textualContent = await textParsingFunction(fileBuffer);

    /** @todo: refetch these to prevent potential data loss */
    const previousProperties = fileEntity.properties as DOCXDocumentProperties;

    const updatedProperties = {
      ...previousProperties,
      "https://blockprotocol.org/@blockprotocol/types/property-type/textual-content/":
        textualContent,
    } as DOCXDocumentProperties;

    await graphApiClient.patchEntity(webMachineActorId, {
      entityId: fileEntity.metadata.recordId.entityId,
      properties: [
        {
          op: "replace",
          path: [],
          value: updatedProperties,
        },
      ],
    });
  }
};
