# TransactionCategorizer Service - Mongoose & MVC Refactoring

This folder contains the refactored TransactionCategorizer application, now using Mongoose ORM instead of the MongoDB driver, with a proper MVC architecture.

## Major Changes

### 1. **MongoDB Driver → Mongoose**
   - Replaced direct MongoDB driver usage with Mongoose ORM
   - Added schema definitions with validation
   - Implemented proper TypeScript types with Mongoose

### 2. **MVC Architecture**
   - **Models**: Added `/src/models` directory with Mongoose schemas
     - `User.model.ts`: User schema with validation
     - `CategoryList.model.ts`: CategoryList schema with validation
   - **Controllers**: Added `/src/controllers` directory
     - Extracted all route logic into dedicated controller files
     - Routes now only handle routing, controllers handle business logic
   - **Services**: Retained service layer for data access
     - Updated to use Mongoose models instead of MongoDB collections

### 3. **Database Connection**
   - Replaced MongoDB client with Mongoose connection
   - Simplified connection logic
   - Better error handling and connection state management

## Benefits

1. **Schema Validation**: Mongoose provides built-in validation at the schema level
2. **Type Safety**: Better TypeScript integration with Mongoose types
3. **Cleaner Code**: Mongoose provides a cleaner API for database operations
4. **Middleware Support**: Can add pre/post hooks for database operations
5. **Better Architecture**: Clear separation of concerns with MVC pattern
6. **Easier Testing**: Controllers can be tested independently of routes

## Project Structure

```
src/
├── controllers/         # Request handlers
│   ├── user.controller.ts
│   ├── categoryList.controller.ts
│   └── transaction.controller.ts
├── models/             # Mongoose schemas
│   ├── User.model.ts
│   └── CategoryList.model.ts
├── routes/             # Express routes
│   ├── index.ts
│   ├── userRoutes.ts
│   ├── categoryListRoutes.ts
│   └── transactionRoutes.ts
├── services/           # Business logic
│   ├── userService.ts
│   └── categoryListService.ts
├── db/                 # Database connection
│   └── mongoose.ts
├── types.ts            # TypeScript interfaces
├── parser.ts           # CSV parser
├── transactions.ts     # Transaction processing
└── server.ts           # Express server
```

## Files Modified/Added

### New Files:
- `/src/models/User.model.ts`
- `/src/models/CategoryList.model.ts`
- `/src/controllers/user.controller.ts`
- `/src/controllers/categoryList.controller.ts`
- `/src/controllers/transaction.controller.ts`
- `/src/db/mongoose.ts`

### Modified Files:
- `/src/types.ts` - Updated interfaces for Mongoose
- `/src/services/*` - Updated to use Mongoose models
- `/src/routes/*` - Refactored to use controllers
- `/src/server.ts` - Updated database connection
- `package.json` - Added Mongoose dependency
