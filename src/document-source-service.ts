import { TransformObjectFields } from "@graphql-tools/wrap";
import { Kind } from "graphql";

export const documentSourceService = ({
  serviceName = "unknown",
}: {
  graphQLURL?: string;
  serviceName?: string;
}) => {
  return new TransformObjectFields((_typeName, _fieldName, fieldConfig) => {
    const service = serviceName;

    const commentToAdd = `Resolved by ${service}.`;

    if (fieldConfig.astNode) {
      fieldConfig.astNode = {
        ...fieldConfig.astNode,
        description: {
          ...fieldConfig.astNode?.description,
          kind: Kind.STRING,
          value: fieldConfig.astNode?.description
            ? fieldConfig.astNode?.description.value.concat(`\n${commentToAdd}`)
            : commentToAdd,
        },
      };
    }

    fieldConfig.description = fieldConfig.description
      ? fieldConfig.description.concat(`\n${commentToAdd}`)
      : commentToAdd;

    return fieldConfig;
  });
};
