import { FunctionComponent } from "react";
import { tw } from "twind";

import { JsonSchema } from "@hashintel/hash-shared/json-utils";
import { tdClasses, trClasses } from "./SchemaPropertiesTable";
import { SchemaPropertyTypeList } from "./SchemaPropertyTypeList";
import { SchemaSelectElementType } from "./SchemaEditor";
import { ToggleInputOrDisplay, TextInputOrDisplay } from "./Inputs";
import { SchemaEditorDispatcher } from "./schemaEditorReducer";
import { Button } from "../../../shared/ui";

type SchemaPropertyRowProps = {
  dispatchSchemaUpdate: SchemaEditorDispatcher;
  GoToSchemaElement: SchemaSelectElementType;
  name: string;
  property: JsonSchema;
  readonly: boolean;
  required: boolean;
};

export const SchemaPropertyRow: FunctionComponent<SchemaPropertyRowProps> = ({
  dispatchSchemaUpdate,
  GoToSchemaElement,
  name,
  property,
  readonly,
  required,
}) => {
  const isArray = property.type === "array";

  const togglePropertyIsArray = () =>
    dispatchSchemaUpdate({
      type: "togglePropertyIsArray",
      payload: { propertyName: name },
    });

  const togglePropertyIsRequired = () =>
    dispatchSchemaUpdate({
      type: "togglePropertyIsRequired",
      payload: { propertyName: name },
    });

  const updatePropertyDescription = (newDescription: string) =>
    dispatchSchemaUpdate({
      type: "updatePropertyDescription",
      payload: { propertyName: name, newPropertyDescription: newDescription },
    });

  const updatePropertyName = (newName: string) =>
    dispatchSchemaUpdate({
      type: "updatePropertyName",
      payload: { oldPropertyName: name, newPropertyName: newName },
    });

  const updatePermittedType = (newType: string) =>
    dispatchSchemaUpdate({
      type: "updatePropertyPermittedType",
      payload: { newType, propertyName: name },
    });

  const deleteProperty = () =>
    dispatchSchemaUpdate({
      type: "deleteProperty",
      payload: { propertyName: name },
    });

  /**
   * @todo deal with tuples and other array keywords, e.g. preferredItems
   */
  const {
    $ref,
    type,
    properties,
    // we want description from [property], never items, but need it excluded from the ...rest
    description: _,
    ...constraints
  } = isArray ? (property.items as JsonSchema) : property;

  const { description } = property;

  return (
    <tr className={trClasses}>
      <td className={tdClasses}>
        <TextInputOrDisplay
          className={tw`w-36`}
          placeholder="The property name"
          readonly={readonly}
          updateText={updatePropertyName}
          value={name}
          updateOnBlur
        />
      </td>
      <td className={tdClasses}>
        <SchemaPropertyTypeList
          hasSubSchema={!!properties}
          propertyName={name}
          GoToSchemaElement={GoToSchemaElement}
          readonly={readonly}
          $ref={$ref}
          type={type}
          updatePermittedType={updatePermittedType}
        />
      </td>
      <td className={tdClasses}>
        <TextInputOrDisplay
          placeholder="Describe the property..."
          readonly={readonly}
          updateText={updatePropertyDescription}
          value={description ?? ""}
          updateOnBlur
        />
      </td>
      <td className={tdClasses}>
        <ToggleInputOrDisplay
          checked={isArray}
          onChange={() => togglePropertyIsArray()}
          readonly={readonly}
        />
      </td>
      <td className={tdClasses}>
        <ToggleInputOrDisplay
          checked={required}
          onChange={() => togglePropertyIsRequired()}
          readonly={readonly}
        />
      </td>
      <td className={tdClasses}>
        {/* @todo constraints may appear on any in a list of types, need to display this multiple times */}
        {Object.entries(constraints).map(([typeName, value]) => (
          <div key={typeName}>
            <pre>
              {typeName}: {JSON.stringify(value, null, 1)}
            </pre>
          </div>
        ))}
      </td>
      <td className={tdClasses}>
        <Button variant="danger" onClick={deleteProperty}>
          Delete
        </Button>
      </td>
    </tr>
  );
};
