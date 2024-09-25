import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import { gql } from "graphql-tag";

const authors = [
  { id: "1", fullName: "J Doe" },
  { id: "2", fullName: "J Dough" },
];

export const schema = createSchema({
  typeDefs: gql`
    type Author {
      id: ID!
      fullName: String!
    }

    type Query {
      authorById(id: ID!): Author
    }
  `,
  resolvers: {
    Query: {
      authorById: (_root, { id }) =>
        authors.find((c) => c.id === id) ||
        new GraphQLError("Record not found", {
          extensions: {
            code: "NOT_FOUND",
          },
        }),
    },
  },
});
