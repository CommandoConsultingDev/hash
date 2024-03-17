import { describe, test, expect } from "vitest";
import * as S from "@effect/schema/Schema";
import * as DataType from "../../src/ontology/DataType";
import * as DataTypeUrl from "../../src/ontology/DataTypeUrl";
import { Either, Option } from "effect";

describe("literal", () => {
  describe("encode", () => {
    test("`number`", () => {
      const numberLiteral = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/number-123/v/1"),
        S.literal(123).pipe(S.title("A constant number of value `123`")),
      );

      const literal = Either.getOrThrow(numberLiteral);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/number-123/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "const": 123,
          "kind": "dataType",
          "title": "A constant number of value \`123\`",
          "type": "number",
        }
      `);
    });

    test("`string`", () => {
      const stringLiteral = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/string-abc/v/1"),
        S.literal("abc").pipe(S.title("A constant string of value `abc`")),
      );

      const literal = Either.getOrThrow(stringLiteral);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/string-abc/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "const": "abc",
          "kind": "dataType",
          "title": "A constant string of value \`abc\`",
          "type": "string",
        }
      `);
    });

    test("`bool`", () => {
      const booleanLiteral = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/boolean-true/v/1"),
        S.literal(true).pipe(S.title("A constant boolean of value `true`")),
      );

      const literal = Either.getOrThrow(booleanLiteral);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/boolean-true/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "const": true,
          "kind": "dataType",
          "title": "A constant boolean of value \`true\`",
          "type": "boolean",
        }
      `);
    });

    test("`null`", () => {
      const nullLiteral = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/null/v/1"),
        S.literal(null).pipe(S.title("A constant null value")),
      );

      const literal = Either.getOrThrow(nullLiteral);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/null/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "kind": "dataType",
          "title": "A constant null value",
          "type": "null",
        }
      `);
    });

    test("`bigint`", () => {
      const bigIntLiteral = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/bigint/v/1"),
        // @ts-expect-error we are just making sure this will fail!
        S.literal(123n).pipe(S.title("A constant bigint of value `123n`")),
      );

      const error = Either.flip(bigIntLiteral).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
        {
          "_tag": "UnsupportedLiteral",
          "literal": "bigint",
        }
      `);
    });
  });
});

describe("keywords", () => {
  describe("encode", () => {
    test("`undefined`", () => {
      const undefinedType = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/undefined/v/1"),
        // @ts-expect-error we are just making sure this will fail!
        S.undefined.pipe(S.title("A constant undefined value")),
      );

      const error = Either.flip(undefinedType).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
      {
        "_tag": "UnsupportedKeyword",
        "keyword": "undefined",
      }
    `);
    });

    test("`void`", () => {
      const voidType = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/void/v/1"),
        // @ts-expect-error we are just making sure this will fail!
        S.void.pipe(S.title("A constant void value")),
      );

      const error = Either.flip(voidType).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
        {
          "_tag": "UnsupportedKeyword",
          "keyword": "void",
        }
      `);
    });

    test("`never`", () => {
      const neverType = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/never/v/1"),
        S.never.pipe(S.title("A constant never value")),
      );

      const error = Either.flip(neverType).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
      {
        "_tag": "UnsupportedKeyword",
        "keyword": "never",
      }
    `);
    });

    test("`unknown`", () => {
      const unknownType = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/unknown/v/1"),
        // @ts-expect-error we are just making sure this will fail!
        S.unknown.pipe(S.title("A constant unknown value")),
      );

      const error = Either.flip(unknownType).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
      {
        "_tag": "UnsupportedKeyword",
        "keyword": "unknown",
      }
    `);
    });

    test("`any`", () => {
      const anyType = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/any/v/1"),
        S.any.pipe(S.title("A constant any value")),
      );

      const error = Either.flip(anyType).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
        {
          "_tag": "UnsupportedType",
          "type": "any",
        }
      `);
    });

    test("unique symbol", () => {
      const symbol = Symbol.for("unique symbol");

      const uniqueSymbol = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/unique-symbol/v/1"),
        // @ts-expect-error we are just making sure this will fail!
        S.uniqueSymbolFromSelf(symbol).pipe(S.title("A unique symbol")),
      );

      const error = Either.flip(uniqueSymbol).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
        {
          "_tag": "UnsupportedKeyword",
          "keyword": "unique symbol",
        }
      `);
    });
  });
});

describe("types", () => {
  describe("encode", () => {
    test("declaration", () => {
      class File {}

      const isFile = (input: unknown): input is File => input instanceof File;

      const FileFromSelf = S.declare(isFile, {
        identifier: "FileFromSelf",
      });

      const declaration = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/declaration/v/1"),
        // @ts-expect-error we are just making sure this will fail!
        FileFromSelf.pipe(S.title("A custom declaration")),
      );

      const error = Either.flip(declaration).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
        {
          "_tag": "UnsupportedDeclaredType",
        }
      `);
    });

    test("bigint", () => {
      const bigInt = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/bigint/v/1"),
        // @ts-expect-error we are just making sure this will fail!
        S.bigintFromSelf.pipe(S.title("A bigint")),
      );

      const error = Either.flip(bigInt).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
        {
          "_tag": "UnsupportedType",
          "type": "bigint",
        }
      `);
    });

    test("object", () => {
      const object = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/object/v/1"),
        // @ts-expect-error we are just making sure this will fail!
        S.object,
      );

      const error = Either.flip(object).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(`
        {
          "_tag": "UnsupportedType",
          "type": "object",
        }
      `);
    });
  });
});

describe("string", () => {
  describe("encode", () => {
    test("standard", () => {
      const string = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/string/v/1"),
        S.string,
      );

      const literal = Either.getOrThrow(string);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/string/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a string",
          "kind": "dataType",
          "title": "string",
          "type": "string",
        }
      `);
    });

    test("minLength", () => {
      const string = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/string/v/1"),
        S.string.pipe(S.minLength(5)),
      );

      const literal = Either.getOrThrow(string);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/string/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a string",
          "kind": "dataType",
          "minLength": 5,
          "title": "string",
          "type": "string",
        }
      `);
    });

    test("maxLength", () => {
      const string = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/string/v/1"),
        S.string.pipe(S.maxLength(5)),
      );

      const literal = Either.getOrThrow(string);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/string/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a string",
          "kind": "dataType",
          "maxLength": 5,
          "title": "string",
          "type": "string",
        }
      `);
    });

    test("pattern", () => {
      const string = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/string/v/1"),
        S.string.pipe(S.pattern(/abc/)),
      );

      const literal = Either.getOrThrow(string);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/string/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a string",
          "kind": "dataType",
          "pattern": "abc",
          "title": "string",
          "type": "string",
        }
      `);
    });

    // TODO: test -> wrong annotation type
  });
});

describe("number", () => {
  describe("encode", () => {
    test("standard", () => {
      const number = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/number/v/1"),
        S.number,
      );

      const literal = Either.getOrThrow(number);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/number/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a number",
          "kind": "dataType",
          "title": "number",
          "type": "number",
        }
      `);
    });

    test("integer", () => {
      const number = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/number/v/1"),
        S.Int,
      );

      const literal = Either.getOrThrow(number);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/number/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a number",
          "kind": "dataType",
          "title": "number",
          "type": "integer",
        }
      `);
    });

    test("multipleOf", () => {
      const number = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/number/v/1"),
        S.number.pipe(S.multipleOf(5)),
      );

      const literal = Either.getOrThrow(number);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/number/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a number",
          "kind": "dataType",
          "multipleOf": 5,
          "title": "number",
          "type": "number",
        }
      `);
    });

    test("minimum", () => {
      const number = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/number/v/1"),
        S.number.pipe(S.greaterThanOrEqualTo(5)),
      );

      const literal = Either.getOrThrow(number);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/number/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a number",
          "kind": "dataType",
          "minimum": 5,
          "title": "number",
          "type": "number",
        }
      `);
    });

    test("maximum", () => {
      const number = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/number/v/1"),
        S.number.pipe(S.lessThanOrEqualTo(5)),
      );

      const literal = Either.getOrThrow(number);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/number/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a number",
          "kind": "dataType",
          "maximum": 5,
          "title": "number",
          "type": "number",
        }
      `);
    });

    test("exclusiveMinimum", () => {
      const number = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/number/v/1"),
        S.number.pipe(S.greaterThan(5)),
      );

      const literal = Either.getOrThrow(number);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/number/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a number",
          "exclusiveMinimum": 5,
          "kind": "dataType",
          "title": "number",
          "type": "number",
        }
      `);
    });

    test("exclusiveMaximum", () => {
      const number = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/number/v/1"),
        S.number.pipe(S.lessThan(5)),
      );

      const literal = Either.getOrThrow(number);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/number/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a number",
          "exclusiveMaximum": 5,
          "kind": "dataType",
          "title": "number",
          "type": "number",
        }
      `);
    });
  });
});

describe("boolean", () => {
  test("encode", () => {
    const boolean = DataType.make(
      DataTypeUrl.parseOrThrow("https://example.com/boolean/v/1"),
      S.boolean,
    );

    const literal = Either.getOrThrow(boolean);

    expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/boolean/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "description": "a boolean",
          "kind": "dataType",
          "title": "boolean",
          "type": "boolean",
        }
      `);
  });
});

describe("enums", () => {
  describe("encode", () => {
    test("numeric (consecutive)", () => {
      enum Fruits {
        Apple,
        Banana,
      }

      const enums = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/enums/v/1"),
        S.enums(Fruits).pipe(S.title("A fruit")),
      );

      const literal = Either.getOrThrow(enums);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/enums/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "kind": "dataType",
          "maximum": 1,
          "minimum": 0,
          "title": "A fruit",
          "type": "integer",
        }
      `);
    });

    test("numeric (holes)", () => {
      enum Fruits {
        Apple = 0,
        Banana = 2,
      }

      const enums = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/enums/v/1"),
        S.enums(Fruits).pipe(S.title("A fruit")),
      );

      const error = Either.flip(enums).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(
        `
        {
          "_tag": "NonConsecutiveIntegerEnum",
        }
      `,
      );
    });

    test("numeric (floating)", () => {
      enum Fruits {
        Apple = 0.5,
        Banana = 1.5,
      }

      const enums = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/enums/v/1"),
        S.enums(Fruits).pipe(S.title("A fruit")),
      );

      const error = Either.flip(enums).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(
        `
        {
          "_tag": "FloatingPointEnum",
        }
      `,
      );
    });

    test("string", () => {
      enum Fruits {
        Apple = "apple",
        Banana = "banana",
      }

      const enums = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/enums/v/1"),
        S.enums(Fruits).pipe(S.title("A fruit")),
      );

      const literal = Either.getOrThrow(enums);

      expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
        {
          "$id": "https://example.com/enums/v/1",
          "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
          "kind": "dataType",
          "pattern": "^(apple)|(banana)$",
          "title": "A fruit",
          "type": "string",
        }
      `);
    });

    test("mixed", () => {
      enum Fruits {
        Apple = "apple",
        Banana = 1,
      }

      const enums = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/enums/v/1"),
        S.enums(Fruits).pipe(S.title("A fruit")),
      );

      const error = Either.flip(enums).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(
        `
        {
          "_tag": "MixedEnum",
        }
      `,
      );
    });

    test("empty", () => {
      enum Fruits {}

      const enums = DataType.make(
        DataTypeUrl.parseOrThrow("https://example.com/enums/v/1"),
        S.enums(Fruits).pipe(S.title("A fruit")),
      );

      const error = Either.flip(enums).pipe(Either.getOrThrow);
      expect(error.reason).toMatchInlineSnapshot(
        `
        {
          "_tag": "EmptyEnum",
        }
      `,
      );
    });
  });
});

describe("template literal", () => {
  test("encode", () => {
    const templateLiteral = DataType.make(
      DataTypeUrl.parseOrThrow("https://example.com/template-literal/v/1"),
      S.templateLiteral(S.literal(123), S.string).pipe(
        S.title("A template literal"),
      ),
    );

    const literal = Either.getOrThrow(templateLiteral);

    expect(DataType.toSchema(literal)).toMatchInlineSnapshot(`
      {
        "$id": "https://example.com/template-literal/v/1",
        "$schema": "https://blockprotocol.org/types/modules/graph/0.3/schema/data-type",
        "kind": "dataType",
        "pattern": "^123.*$",
        "title": "A template literal",
        "type": "string",
      }
    `);
  });
});
