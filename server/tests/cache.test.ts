import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "../src/lib/cache";

describe("TtlCache", () => {
  it("returns cached values until they expire", async () => {
    vi.useFakeTimers();
    const cache = new TtlCache(1_000);
    const loader = vi.fn(async () => "fresh");

    await expect(cache.getOrSet("k", loader)).resolves.toBe("fresh");
    await expect(cache.getOrSet("k", loader)).resolves.toBe("fresh");
    expect(loader).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_001);
    await expect(cache.getOrSet("k", loader)).resolves.toBe("fresh");
    expect(loader).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("supports prefix invalidation", () => {
    const cache = new TtlCache(5_000);
    cache.set("public:session:abc", { id: 1 });
    cache.set("public:results:abc", { groups: [] });
    cache.set("session:detail:9", { id: 9 });
    cache.deletePrefix("public:");
    expect(cache.get("public:session:abc")).toBeUndefined();
    expect(cache.get("public:results:abc")).toBeUndefined();
    expect(cache.get("session:detail:9")).toEqual({ id: 9 });
  });
});
