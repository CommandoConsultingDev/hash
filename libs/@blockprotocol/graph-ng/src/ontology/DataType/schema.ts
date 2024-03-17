import { Option } from "effect";

import {
  pruneUndefinedShallow,
  UndefinedOnPartialShallow,
} from "../../internal/schema.js";
import { type DataType } from "../DataType.js";
import * as DataTypeUrl from "../DataTypeUrl.js";

interface TypelessDataTypeSchema {
  $schema: "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type";
  kind: "dataType";
  $id: DataTypeUrl.DataTypeUrl;

  title: string;
  description?: string;
}

export interface BaseDataTypeSchema extends TypelessDataTypeSchema {
  type: string;
}

interface BaseProperties {
  title?: string;
  description?: string;
}

export function makeBase(
  type: DataType<unknown>,
  properties: BaseProperties,
): Option.Option<TypelessDataTypeSchema> {
  if (properties.title === undefined) {
    return Option.none();
  }

  return Option.some(
    pruneUndefinedShallow({
      $schema:
        "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
      kind: "dataType",
      $id: type.id,

      title: properties.title,
      description: properties.description,
    } satisfies UndefinedOnPartialShallow<TypelessDataTypeSchema>),
  );
}

interface ConstantDataTypeSchema<T> {
  const?: T;
}

interface NumericTypeSchema extends ConstantDataTypeSchema<number> {
  multipleOf?: number;

  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
}

export interface NumberDataTypeSchema
  extends BaseDataTypeSchema,
    NumericTypeSchema {
  type: "number";
}

export interface IntegerDataTypeSchema
  extends BaseDataTypeSchema,
    NumericTypeSchema {
  type: "integer";
}

export interface StringDataTypeSchema
  extends BaseDataTypeSchema,
    ConstantDataTypeSchema<string> {
  type: "string";

  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface BooleanDataTypeSchema
  extends BaseDataTypeSchema,
    ConstantDataTypeSchema<boolean> {
  type: "boolean";
}

export interface NullDataTypeSchema
  extends BaseDataTypeSchema,
    ConstantDataTypeSchema<null> {
  type: "null";
}

// DataType arrays are opaque in `0.3`, with the only allowed constant value being `[]`
// `items`, `minItems`, `maxItems`, `uniqueItems` and so on are not supported
export interface ArrayDataTypeSchema
  extends BaseDataTypeSchema,
    ConstantDataTypeSchema<never[]> {
  type: "array";
}

// DataType objects are opaque in `0.3`.
// `properties`, `required`, `additionalProperties`, `minProperties`, `maxProperties` and so on are not supported
export interface ObjectDataTypeSchema extends BaseDataTypeSchema {
  type: "object";
}

export type DataTypeSchema =
  | NumberDataTypeSchema
  | IntegerDataTypeSchema
  | StringDataTypeSchema
  | BooleanDataTypeSchema
  | NullDataTypeSchema
  | ArrayDataTypeSchema
  | ObjectDataTypeSchema;
