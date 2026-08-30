const GOOGLE_PLACE_DETAILS_API = "https://places.googleapis.com/v1/places";
const FALLBACK_RESPONSE = { ok: true, reviews: [], fallback: true };
const CACHE_SECONDS = 60 * 60 * 12;

function cacheResponse(res, seconds = CACHE_SECONDS) {
  res.setHeader(
    "Cache-Control",
    `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`,
  );
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    cacheResponse(res, 300);
    return res.status(200).json(FALLBACK_RESPONSE);
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const limitRaw = Number(url.searchParams.get("limit") || "10");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 5)
    : 5;

  try {
    const response = await fetch(`${GOOGLE_PLACE_DETAILS_API}/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,displayName,googleMapsUri,reviews",
      },
    });

    if (!response.ok) {
      cacheResponse(res, 300);
      return res.status(200).json(FALLBACK_RESPONSE);
    }

    const payload = await response.json();
    const placeGoogleMapsUri = payload.googleMapsUri || "";

    const reviews = Array.isArray(payload?.reviews)
      ? payload.reviews
          .filter(
            (review) =>
              review?.text?.text && review?.authorAttribution?.displayName,
          )
          .slice(0, limit)
          .map((review) => ({
            authorName: review.authorAttribution.displayName,
            authorPhotoUrl: review.authorAttribution.photoUri || "",
            text: review.text.text,
            rating: review.rating || 0,
            publishedAtLabel: review.relativePublishTimeDescription || "",
            googleMapsUri: review.googleMapsUri || placeGoogleMapsUri,
          }))
      : [];

    cacheResponse(res);
    return res.status(200).json({ ok: true, reviews });
  } catch {
    cacheResponse(res, 300);
    return res.status(200).json(FALLBACK_RESPONSE);
  }
}
