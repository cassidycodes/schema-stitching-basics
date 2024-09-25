# Schema Stitching Workshop

In this workshop, we will build a GraphQL gateway that stitches schemas from
three applications. The applications are:

1. `author-service`: A service that provides information about authors.
2. `book-service`: A service that provides information about books written by authors.
3. `publisher-service`: A service that provides information about book publishers.

The gateway will provide a single schema that combines the schemas of the three
services and allow us to fetch information about authors and their books in
a single request.

## 1. Setup

```sh
yarn install
yarn start
```

Visit `http://localhost:4000/graphql` to see the schema and make some queries.

You will also see sub-schema servers running on ports `4001`, `4002` and `4003`.

When you make a request to the gateway server on port `4000`, you will see logs
in the terminal showing which sub-schema services are being queried.

```log
    book-service executor sending: {
      query: 'query bookById($id: ID!) {\n' +
        '  __typename\n' +
        '  bookById(id: $id) {\n' +
        '    id\n' +
        '    title\n' +
        '  }\n' +
        '}',
      variables: { id: '1' }
    }
```

You can run the test suite with:

```sh
yarn test
```

There is a single test for getting a book by its id.

## 2. Add a "belongs to" relationship between books and authors

Right now we have two services running but no relationship between them. Let's
add a feature so that each author can have on book.

In `book-service/schema.ts` add an `authorID` for each book:

```ts
// src/services/book-service/schema.ts
const books = [
  { id: "1", balance: 15, authorId: "1" },
  { id: "2", balance: 3, authorId: "1" },
  { id: "3", balance: 150, authorId: "2" },
  { id: "4", balance: 3111, authorId: "2" },
];
```

> [!IMPORTANT]
> Use strings for your IDs. In GraphQL an `ID` type is a string. If you use
> integers, you'll encounter errors later.

Add the `Author` type to your schema so that `author-service` can return a
partial author.

> [!TIP]
> Don't copy past! Only add the new `author` field to the schema.

```graphql
"""
src/services/book-service/schema.ts
"""
type Author {
  id: ID!
}

type Book {
  id: ID!
  balance: String!
  author: Author
}
```

And add a resolver for `Book.author`:

```typescript
Query: {
  // resolver for `authorById`
},
Book: {
  author: (book) => ({ id: book.authorId}),
},
```

At this point, we can query for an book and the author's `id`. But if we
ask for the Author's `fullName`, we'll get an error because the gateway does
not know how to merge the resolvers for `Author` fields.

```graphql
query bookById {
  bookById(id: 1) {
    id
    balance
    author {
      id
      fullName
    }
  }
}
```

In `make-gateway-schema` we now need to tell `author-service` how to get the `authorId`
from the `Author` object returned by `author-service`. Add the following merge
arguments to the author service sub-subschema config in `make-gateway-schema.ts`:

```typescript
// src/make-gateway-schema.ts
{
  schema: authorSchema,
  executor: authorExec,
  transforms: [documentSourceService({ serviceName: "author-service" })],
  merge: {
    Author: {
      // name of the field to query for books
      fieldName: "authorById",
      // name of the key field on the Book returned from author-service
      selectionSet: "{ id }",
      // Format the key field into query arguments
      // `args` is used for single record fetching
      args: ({ id }) => ({ id })
    }
  }
}
```

Now we can query for an book and the author that owns that book:

```graphql
query bookById {
  bookById(id: 1) {
    id
    balance
    author {
      id
      fullName
    }
  }
}
```

## 3. Modify the author-book relationship so authors have many books

Now we want to be able to query by `authorId` since the front end will likely
have the author's ID before fetching the books.

We are going to leave the `Book.author` relationship in place so that we
can see how resolvers work with schema stitching in the next step.

Add `Author.books` to the `book-service` schema:

```graphql
"""
src/services/book-service/schema.ts
"""
type Author {
  id: ID!
  books: [Book]
}

type Book {
  """
  Unique identifier for the book
  """
  id: ID!

  """
  Identifier for the book owner
  """
  authorId: ID!

  """
  Author that owns the book.
  """
  author: Author

  """
  Balance of the book in cents
  """
  balance: Int!
}
```

In order to query the stitched schema with `authorById`, we need to provide a
similar query on `book-service`, so that we can fetch all of a author's
books in a single query:

```graphql
src/services/book-service/schema.ts
type Query {
  bookById(id: ID!): Book
  _authorById(id: ID!): Author
}
```

> [!NOTE]
> The `_` prefix is a convention to indicate that a field is not intended to be
> used by authors. This is a way to avoid naming conflicts between the fields of
> different services.

Add a `Query._authorById` resolver:

```typescript
// src/services/book-service/schema.ts
_authorById: (_root, { id }) => {
  return {
    id,
    books: books.filter(a => a.authorId === id),
  }
},
```

And add a `Author.books` resolver:

```typescript
// src/services/book-service/schema.ts
Author: {
  books: (author) => books.filter((a) => a.authorId === author.id),
}
```

Now in `make-gateway-schema` we need to add merge arguments so that we merge
the `Author` types:

For the `book-service` schema in `make-gateway-schema`, add a `Author` merge
argument:

```typescript
// src/make-gateway-schema.ts
merge: {
  Author: {
    fieldName: "_authorById",
    selectionSet: "{ id }",
    args: ({ id }) => ({ id })
  }
}
```

You should already have a similar merge argument for the `author-service` schema:

```typescript
// src/make-gateway-schema.ts
Author: {
  fieldName: "authorById",
  selectionSet: "{ id }",
  args: ({ id }) => ({ id })
}
```

Now we can query for a author and all their books:

```graphql
query authorById {
  authorById(id: 1) {
    id
    fullName
    books {
      id
      balance
    }
  }
}
```

## 4. Add conflicting fields to both services

There are times when two services have the same field. Sometimes this is due to
poor planning, and the two fields with the same name are actually different.
Other times, the fields are the same and we need to resolve the conflict.

Lets add a duplicate field that serves the same data to two services. In
`book-service/schema.ts` add a `fullName` field:

```graphql
"""
src/services/book-service/schema.ts
"""
type Author {
  id: ID!
  """
  Incorrect full name
  """
  fullName: String!
}
```

Let's also add a resolver for `Author.fullName`. To make this really clear,
we are going to make the resolver return an incorrect full name.

```typescript
// src/services/book-service/schema.ts
Author: {
  fullName: () => "Incorrect Full Name",
  //... rest of resolvers
}
```

Now, let's issue a query and see what we get back.

```graphql
query authorbyId {
  authorById(id: 1) {
    id
    fullName
    books {
      id
      balance
    }
  }
}
```

We get the correct full name back because the gateway knows it can get all the
`Author` fields from the `author-service` schema. And it needs to fetch `Author`
data before it can fetch books.

Now, in `stitchSchema`, swap the order of the schemas so that `author-service`
comes first and `book-service` comes second.

In the schema explorer, we now see the "Incorrect Full Name" documentation
string. But we still get the correct full name back.

Why? Again, this is because the gateway has to fetch `Author` first it knows
if can fetcsh `fullName` from `author-service` as well. So it asks
`author-service` for all the data it has available.

Something really strange (but explainable!) happens when both services are
able to resolve `Author.fullName`.

The two following queries will return different results:

```graphql
query bookById {
  bookById(id: 1) {
    id
    balance
    author {
      id
      fullName
    }
  }
}

query authorById {
  authorById(id: 1) {
    id
    fullName
  }
}
```

`bookById` returns the incorrect full name because the gateway knows it does
not need to reach out to `author-service` to get any data.

Similarly, `authorById` returns the correct full name because it only
needs to reach out to `author-service`.

> [!IMPORTANT]
> Keep your data consistent! The only fields we should share across services are
> canonical IDs and unique identifiers.

If you cannot remove the incorrect field from the service, you can filter the
field out of the subschema so that the gateway doesn't know it exists.

### 4.1 Filtering to Resolve Conflicting Resolvers

Filtering works by removing fields from the schema before they are stitched.

In book-service/schema.ts add a filter to remove the `fullName` field:

```typescript
// src/services/book-service/schema.ts

import { FilterObjectFields, wrapSchema } from "@graphql-tools/wrap";

const bookSchema = createSchema({ // ... });

export const schema = wrapSchema({
  schema: bookSchema,
  transforms: [
    new FilterObjectFields((typeName, fieldName) => {
      return !(typeName === "Author" && fieldName === "fullName");
    }),
  ],
})
```

Now we can can issue the same query again and we will get the `fullName` field
from the correct service.

```graphql
query bookById {
  bookById(id: 1) {
    id
    author {
      fullName
    }
  }
}
```

### 4.2 Stitching Directives to Resolve Conflicting Type Definitions

Stitching directives are GraphQL directives that are read when stitching schemas
to determine how types and fields should be stitched. These directive only
affect how the type definitions are stitched and what arguments are passed to
queries. Stitching directives do not affect how the data is resolved.

Lets give two overlapping fields different types and see how the gateway schema
is created.

```graphql
"""
src/services/book-service/schema.ts
"""
type Author {
  """
  ID from book-service schema
  """
  id: String!
  fullName: String
}
```

```graphql
"""
src/services/author-service/schema.ts
"""
type Author {
  """
  ID from author-service schema
  """
  id: ID!
}
```

> [!WARNING]
> At this point our server will boot and print an error. In the future, you will
> have to fix this error for the server to boot.

```log
[gateway] [ERROR] 20:22:14 Error: Definitions of field "Author.id" implement
inconsistent named types across subschemas
```

In the schema explorer, we see that `Author.id` is a `String` rather than an `ID`.
To ensure the type is consistent and the correct docs field makes it to the
schema, we can add stitching directives.

Add stitching directives to the `author-service` schema:

```typescript
// src/service/author-service/schema.ts

import { stitchingDirectives } from "@graphql-tools/stitching-directives";

const { allStitchingDirectivesTypeDefs, stitchingDirectivesValidator } =
  stitchingDirectives();

export const schema = stitchingDirectivesValidator(
  createSchema({
    typeDefs: gql`
      ${allStitchingDirectivesTypeDefs}
      type Book {
        id: ID!
      }

    type Author @canonical {
      id: ID!
      fullName: String!
    }
    // ... rest of schema
    `,
    resolvers: {
      // resolvers
    },
  }),
);
```

Now in `make-gateway-schema` we can add a directive transformer:

```typescript
// src/make-gateway-schema.ts

import { stitchingDirectives } from "@graphql-tools/stitching-directives";

const { allStitchingDirectivesTypeDefs, stitchingDirectivesTransformer } =
  stitchingDirectives();

const schema = stitchSchemas({
  // add stitching directives to the gateway schema
  typeDefs: [allStitchingDirectivesTypeDefs],
  // add the directive transformer
  subschemaConfigTransforms: [stitchingDirectivesTransformer],
  // ... rest of schema
});
```

Now, when we look at the stitched schema documentation, we see that `Author.id`
is an `ID` rather than a `String`.

## 5. Add publisher service schema

You likely noticed that we have an `publisher-service` running too. We
haven't stitched this schema in yet. So let's add it to our gateway.

But first, lets do it the wrong way so we can see an error that'll help
us understand how schema stitching works.

In `book-service`, let's add an `Publisher` relationship to `Book`:

```typescript
// src/services/book-service/schema.ts

const books = [
  { id: "1", balance: 15, authorId: "1", publisherId: "1" },
  { id: "2", balance: 3, authorId: "1", publisherId: "2" },
  { id: "3", balance: 150, authorId: "2", publisherId: "1" },
  { id: "4", balance: 3111, authorId: "2", publisherId: "2" },
];
```

And modify the `book-service` schema so that it's aware of this relationship:

```graphql
type Book {
  id: ID!
  balance: Int!

  """
  Publisher that holds the book
  """
  publisher: Publisher!
}

type Publisher {
  id: ID!
}
```

Add an `Book.publisher` resolver:

```typescript
Book: {
  publisher: (book) => ({ id: book.publisherId }),
},
```

In `make-gateway-schema` add the `publisher-service` schema:

```typescript
{
  schema: publisherSchema,
  executor: publisherExec,
  transforms: [
    documentSourceService({ serviceName: "publisher-service" }),
  ],
},

```

Finally in the `publisher-service` schema add `merge` arguments like so:

```typescript
merge: {
  Publisher: {
    fieldName: "publisherById",
    selectionSet: "{ id }",
    args: (originalObject) => ({ id: originalObject.id }),
  },
},
```

Now we can use our `authorById` query to get all the books and the books' publishers:

```graphql
query authorById {
  authorById(id: 1) {
    id
    fullName
    books {
      id
      balance
      publisher {
        id
        name
      }
    }
  }
}
```

> [!CAUTION]
> We just made an n+1 query across the network! Have a look at the logs and
> you'll see that we hit `publisher-service` once for every book.

## 6. Use array batching to fetch publishers

There are two ways of fixing the n+1 we see above.

1. Query batching: query batching works for back end services that can receive
   multiple queries per request.
2. Array batching: array batching works when the back end serves an array
   endpoint to fetch many records.

For this workshop, we are only going to look at array batching. Query batching
is easy to configure only if your back end can support it.

First, we want to head over to the `publisher-service` schema and add a query
that lets us find publishers by an array of IDs.

```graphql
"""
src/services/publisher-service/schema.ts
"""
type Query {
  publishersByIds(ids: [ID!]): [Publisher]
}
```

Then add a resolver for that query:

```typescript
resolvers: {
  Query: {
    publishersByIds: (_root, { ids }) =>
     (publishers.filter(i => ids.includes(i.id))),
  }
}
```

Now in `make-gateway-schema` we need to tell the `publisher-service` schema
to use array batching:

```typescript
merge: {
  Publisher: {
    // update to use the plural field name
    fieldName: "publishersByIds",
    selectionSet: "{ id }",
    // Fetch the key field from each record
    key: ({ id })=> id,
    // Format all the keys into query arguments
    // `argsFromKeys` is used for array batching
    argsFromKeys: ids => ({ ids }),
  }
}
```

Now let's try execute our query again and we'll see that we have a single
array-based query to `publisher-service`.

```graphql
query authorById {
  authorById(id: 1) {
    id
    fullName
    books {
      id
      balance
      publisher {
        id
        name
      }
    }
  }
}
```

## 7. Filter internal queries out of the gateway schema

Back in step #3 we added a root query to `book-service` called `_authorById`.
We needed this query so that we can get the `Author` data from both
`author-service` and `book-service`. But we don't want to expose this query
to the front end. Let's clean up our gateway schema by removing that query
from the stitched schema.

In `make-gateway-schema` change the `makeGatewaySchema` to return a wrapped
schema that adds a transformation:

```typescript
return wrapSchema({
  schema,
  transforms: [
    // We remove _authorById from the super-schema, so that the sub-schema still
    // has this query and can be used to resolve Author in book-service
    new FilterRootFields((operation, fieldName) => {
      return !(operation === "Query" && fieldName === "_authorById");
    }),
  ],
});
```

## 8. Stretch goals

1. Add integration tests that ensure publishers are fetched with array batching.
2. Add a limit to the number of publishers that can be fetched in a single
   query, add batch loader options to request the correct number of publishers
   per query.
3. Add an integration test tests that multiple batched queries are made.
