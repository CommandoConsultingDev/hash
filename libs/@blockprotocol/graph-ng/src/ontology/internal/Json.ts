import * as S from "@effect/schema/Schema";
import * as Equivalence from "@effect/schema/Equivalence";

export type Value =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: Value }
  | ReadonlyArray<Value>;

export const Value: S.Schema<Value> = S.union(
  S.string,
  S.number,
  S.boolean,
  S.null,
  S.undefined,
  S.record(
    S.string,
    S.suspend(() => Value),
  ),
  S.array(S.suspend(() => Value)),
);

export const ValueEquivalence = Equivalence.make(Value);
