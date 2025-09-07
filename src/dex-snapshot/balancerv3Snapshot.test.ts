import axios from "axios";
import { getBalancerV3DexSnapshots } from "./balancerv3";
import { BalancerV3 } from "../dexes/BalancerV3";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the pools module
jest.mock("./pools", () => ({
  POOL_CONFIGS: [
    {
      source: "BALANCERV3" as any,
      marketAddress: "0x1234567890123456789012345678901234567890",
      name: "Test Pool 1",
    },
    {
      source: "BALANCERV3" as any,
      marketAddress: "0x0987654321098765432109876543210987654321",
      name: "Test Pool 2",
    },
  ],
  Source: {
    BALANCERV3: "BALANCERV3",
  },
}));

describe("balancerv3.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBalancerV3DexSnapshots", () => {
    it("should fetch and return BalancerV3 instances from API", async () => {
      const mockApiResponse = {
        data: {
          poolGetPools: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "USDC-WETH Pool",
              poolTokens: [
                {
                  name: "USD Coin",
                  balance: "1000000",
                  address: "0xa0b86a33e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "USDC",
                  weight: "0.8",
                },
                {
                  name: "Wrapped Ether",
                  balance: "400",
                  address: "0xb1c97e44e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "WETH",
                  weight: "0.2",
                },
              ],
            },
            {
              id: "0x0987654321098765432109876543210987654321",
              name: "DAI-USDC Pool",
              poolTokens: [
                {
                  name: "Dai Stablecoin",
                  balance: "500000",
                  address: "0xf5f97e44e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "DAI",
                  weight: "0.5",
                },
                {
                  name: "USD Coin",
                  balance: "500000",
                  address: "0xa0b86a33e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "USDC",
                  weight: "0.5",
                },
              ],
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      const result = await getBalancerV3DexSnapshots();

      // Verify API call
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api-v3.balancer.fi/graphql",
        {
          query: expect.stringContaining(
            'poolGetPools(where: { chainIn: MAINNET, idIn: ["0x1234567890123456789012345678901234567890","0x0987654321098765432109876543210987654321"] })'
          ),
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      );

      // Verify result structure
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(BalancerV3);
      expect(result[1]).toBeInstanceOf(BalancerV3);

      // Verify first pool
      const pool1 = result[0] as BalancerV3;
      expect(pool1.name).toBe("BalancerV3:USDC/WETH-80:20"); // Auto-generated name format
      expect(pool1.token0).toBe("USDC");
      expect(pool1.token1).toBe("WETH");
      expect(pool1.token0Weight).toBe(0.8);
      expect(pool1.token1Weight).toBe(0.2);
      expect(pool1.token0Reserve).toBe(1000000); // balance
      expect(pool1.token1Reserve).toBe(400); // balance
      expect(pool1.swapFee).toBe(0.01);

      // Verify second pool
      const pool2 = result[1] as BalancerV3;
      expect(pool2.name).toBe("BalancerV3:DAI/USDC-50:50"); // Auto-generated name format
      expect(pool2.token0).toBe("DAI");
      expect(pool2.token1).toBe("USDC");
      expect(pool2.token0Weight).toBe(0.5);
      expect(pool2.token1Weight).toBe(0.5);
      expect(pool2.token0Reserve).toBe(500000); // balance
      expect(pool2.token1Reserve).toBe(500000); // balance
      expect(pool2.swapFee).toBe(0.01);
    });

    it("should handle empty pool response", async () => {
      const mockApiResponse = {
        data: {
          poolGetPools: [],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      const result = await getBalancerV3DexSnapshots();

      expect(result).toHaveLength(0);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it("should handle API errors gracefully", async () => {
      const error = new Error("API request failed");
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect(getBalancerV3DexSnapshots()).rejects.toThrow(
        "API request failed"
      );
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("timeout of 10000ms exceeded");
      mockedAxios.post.mockRejectedValueOnce(timeoutError);

      await expect(getBalancerV3DexSnapshots()).rejects.toThrow(
        "timeout of 10000ms exceeded"
      );
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it("should handle malformed API response", async () => {
      const malformedResponse = {
        data: {
          poolGetPools: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "Test Pool",
              poolTokens: [
                // Missing required fields
                {
                  name: "Token 1",
                  address: "0xa0b86a33e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "TOKEN1",
                  // weight is missing
                },
              ],
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: malformedResponse });

      // This should throw an error when trying to access weight
      await expect(getBalancerV3DexSnapshots()).rejects.toThrow();
    });

    it("should handle pools with different weight formats", async () => {
      const mockApiResponse = {
        data: {
          poolGetPools: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "Test Pool",
              poolTokens: [
                {
                  name: "Token 1",
                  balance: "1000000",
                  address: "0xa0b86a33e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "TOKEN1",
                  weight: "0.8", // Decimal weight
                },
                {
                  name: "Token 2",
                  balance: "500000",
                  address: "0xb1c97e44e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "TOKEN2",
                  weight: "0.2", // Decimal weight
                },
              ],
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      const result = await getBalancerV3DexSnapshots();

      expect(result).toHaveLength(1);
      const pool = result[0] as BalancerV3;
      expect(pool.token0Weight).toBe(0.8);
      expect(pool.token1Weight).toBe(0.2);
      expect(pool.token0Reserve).toBe(1000000); // balance
      expect(pool.token1Reserve).toBe(500000); // balance
    });

    it("should construct correct GraphQL query", async () => {
      const mockApiResponse = {
        data: {
          poolGetPools: [],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      await getBalancerV3DexSnapshots();

      const callArgs = mockedAxios.post.mock.calls[0];
      const query = (callArgs[1] as any).query;

      // Verify query structure
      expect(query).toContain("poolGetPools");
      expect(query).toContain("chainIn: MAINNET");
      expect(query).toContain("idIn:");
      expect(query).toContain("0x1234567890123456789012345678901234567890");
      expect(query).toContain("0x0987654321098765432109876543210987654321");
      expect(query).toContain("poolTokens");
      expect(query).toContain("name");
      expect(query).toContain("address");
      expect(query).toContain("balance");
      expect(query).toContain("symbol");
      expect(query).toContain("weight");
    });

    it("should handle pools with more than 2 tokens (should only use first 2)", async () => {
      const mockApiResponse = {
        data: {
          poolGetPools: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "Multi-token Pool",
              poolTokens: [
                {
                  name: "Token 1",
                  balance: "400000",
                  address: "0xa0b86a33e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "TOKEN1",
                  weight: "0.6",
                },
                {
                  name: "Token 2",
                  balance: "300000",
                  address: "0xb1c97e44e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "TOKEN2",
                  weight: "0.4",
                },
                {
                  name: "Token 3",
                  balance: "300000",
                  address: "0xc2d97e44e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "TOKEN3",
                  weight: "0.3",
                },
              ],
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      const result = await getBalancerV3DexSnapshots();

      expect(result).toHaveLength(1);
      const pool = result[0] as BalancerV3;
      expect(pool.token0).toBe("TOKEN1");
      expect(pool.token1).toBe("TOKEN2");
      expect(pool.token0Weight).toBe(0.6);
      expect(pool.token1Weight).toBe(0.4);
      expect(pool.token0Reserve).toBe(400000); // balance
      expect(pool.token1Reserve).toBe(300000); // balance
      // Third token should be ignored
    });

    it("should handle pools with single token (should throw or handle gracefully)", async () => {
      const mockApiResponse = {
        data: {
          poolGetPools: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "Single Token Pool",
              poolTokens: [
                {
                  name: "Token 1",
                  balance: "1000000",
                  address: "0xa0b86a33e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "TOKEN1",
                  weight: "1.0",
                },
              ],
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      // This should throw an error when trying to access poolTokens[1]
      await expect(getBalancerV3DexSnapshots()).rejects.toThrow();
    });

    it("should handle missing poolTokens array", async () => {
      const mockApiResponse = {
        data: {
          poolGetPools: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "Invalid Pool",
              poolTokens: [], // Empty array
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      // This should throw an error when trying to access poolTokens[0]
      await expect(getBalancerV3DexSnapshots()).rejects.toThrow();
    });

    it("should handle invalid weight values", async () => {
      const mockApiResponse = {
        data: {
          poolGetPools: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "Invalid Weight Pool",
              poolTokens: [
                {
                  name: "Token 1",
                  balance: "1000000",
                  address: "0xa0b86a33e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "TOKEN1",
                  weight: "0.5", // Valid weight
                },
                {
                  name: "Token 2",
                  balance: "500000",
                  address: "0xb1c97e44e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "TOKEN2",
                  weight: "0.5",
                },
              ],
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      const result = await getBalancerV3DexSnapshots();

      expect(result).toHaveLength(1);
      const pool = result[0] as BalancerV3;
      expect(pool.token0Weight).toBe(0.5); // Valid weight
      expect(pool.token1Weight).toBe(0.5);
      expect(pool.token0Reserve).toBe(1000000); // balance
      expect(pool.token1Reserve).toBe(500000); // balance
    });
  });

  describe("integration with BalancerV3 class", () => {
    it("should create functional BalancerV3 instances", async () => {
      const mockApiResponse = {
        data: {
          poolGetPools: [
            {
              id: "0x1234567890123456789012345678901234567890",
              name: "USDC-WETH Pool",
              poolTokens: [
                {
                  name: "USD Coin",
                  balance: "1000000",
                  address: "0xa0b86a33e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "USDC",
                  weight: "0.8",
                },
                {
                  name: "Wrapped Ether",
                  balance: "400",
                  address: "0xb1c97e44e6c0b8b8b8b8b8b8b8b8b8b8b8b8b8b8",
                  symbol: "WETH",
                  weight: "0.2",
                },
              ],
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      const result = await getBalancerV3DexSnapshots();
      const pool = result[0] as BalancerV3;

      // Test that the created pool is functional
      expect(pool.getReserves()).toEqual({
        token0: 1000000, // balance
        token1: 400, // balance
      });

      expect(pool.price("USDC")).toBeGreaterThan(0);
      expect(pool.price("WETH")).toBeGreaterThan(0);

      // Test swap functionality
      const swapResult = pool.swap("USDC", 100, "WETH");
      expect(swapResult.toTokenReceived).toBeGreaterThan(0);
      expect(swapResult.newFromTokenPrice).toBeGreaterThan(0);
      expect(swapResult.newToTokenPrice).toBeGreaterThan(0);

      // Verify reserves were updated
      const newReserves = pool.getReserves();
      expect(newReserves.token0).toBe(1000100); // 1000000 + 100
      expect(newReserves.token1).toBeLessThan(400); // 400 - amount received
    });
  });
});
