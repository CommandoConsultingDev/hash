import { blockProtocolHubOrigin } from "@local/hash-isomorphic-utils/blocks";
import fetch from "node-fetch";

import { BlockProtocolBlock, ResolverFn } from "../../api-types.gen";
import { GraphQLContext } from "../../context";

export const getBlockProtocolBlocksResolver: ResolverFn<
  BlockProtocolBlock[],
  {},
  GraphQLContext,
  {}
> = async () => {
  const apiKey = process.env.BLOCK_PROTOCOL_API_KEY;

  if (!apiKey) {
    throw new Error("BLOCK_PROTOCOL_API_KEY env variable is missing!");
  }

  const res = await fetch(`${blockProtocolHubOrigin}/api/blocks`, {
    headers: { "x-api-key": apiKey },
  });

  const { results } = await res.json();

  return results as BlockProtocolBlock[];
};
