import mongoose from "mongoose";

// Runs fn(session) inside a MongoDB transaction: every write that passes the
// session is committed together or not at all.
//
// Transactions need a replica set (MongoDB Atlas always is one). A plain local
// `mongod` is not, so there we fall back to running fn(null) without a
// transaction. That is safe because the failure happens on the first operation,
// before anything was written.
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (transactionsUnsupported(err)) return fn(null);
    throw err;
  } finally {
    await session.endSession();
  }
}

function transactionsUnsupported(err) {
  return (
    err?.code === 20 || // IllegalOperation
    /replica set|Transaction numbers are only allowed/i.test(err?.message || "")
  );
}
