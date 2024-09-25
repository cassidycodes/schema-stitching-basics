import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import { gql } from "graphql-tag";

const books = [
  { id: "1", title: "Book 1" },
  { id: "2", title: "Book 2" },
  { id: "3", title: "Book 3" },
  { id: "4", title: "Book 4" },
];

export const schema = createSchema({
  typeDefs: gql`
    type Book {
      """
      Unique identifier for the book
      """
      id: ID!

      """
      The title of the book
      """
      title: String!
    }

    type Query {
      bookById(id: ID!): Book
    }
  `,
  resolvers: {
    Query: {
      bookById: (_root, { id }) =>
        books.find((a) => a.id === id) ||
        new GraphQLError("Record not found", {
          extensions: {
            code: "NOT_FOUND",
          },
        }),
    },
  },
});
