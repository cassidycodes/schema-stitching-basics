import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import { gql } from "graphql-tag";

const publishers = [
  { id: "1", name: "Green Book" },
  { id: "2", name: "Yellow Book" },
  { id: "3", name: "Red Book" },
];

export const schema = createSchema({
  typeDefs: gql`
    type Publisher {
      id: ID!
      name: String!
    }

    type Query {
      publisherById(id: ID!): Publisher
    }
  `,
  resolvers: {
    Query: {
      publisherById: (_root, { id }) =>
        publishers.find((i) => i.id === id) ||
        new GraphQLError("Record not found", {
          extensions: {
            code: "NOT_FOUND",
          },
        }),
    },
  },
});
