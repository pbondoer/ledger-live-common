// @flow
import { getEnv } from "./env";
import { sha256 } from "./crypto/sha256";

const userHashesPerUserId = (userId: string) => {
  const firmwareNonce = sha256(userId + "|firmwareNonce").slice(0, 6);
  return { firmwareNonce };
};

let cache;
export const getUserHashes = () => {
  const userId = getEnv("USER_ID");
  if (cache && userId === cache.userId) {
    return cache.value;
  }
  cache = {
    userId,
    value: userHashesPerUserId(userId)
  };
  return cache.value;
};
