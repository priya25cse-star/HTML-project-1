const express = require("express");
const { HttpError } = require("../utils/errors");
module.exports = function recipeRoutes() {
  const router = express.Router();
  let cache;
  let expires = 0;
  let pending;
  router.get("/", async (req, res) => {
    if (cache && expires > Date.now()) return res.json(cache);
    try {
      if (!pending)
        pending = (async () => {
          const response = await fetch(
            "https://www.themealdb.com/api/json/v1/1/search.php?s=salad",
            { signal: AbortSignal.timeout(6000) },
          );
          if (!response.ok) throw new Error("Upstream unavailable");
          const data = await response.json();
          const recipes = (data.meals || []).slice(0, 3).map((meal) => ({
            id: meal.idMeal,
            name: meal.strMeal,
            category: meal.strCategory,
            image: meal.strMealThumb,
            url: `https://www.themealdb.com/meal/${encodeURIComponent(meal.idMeal)}`,
          }));
          cache = { source: "TheMealDB", recipes };
          expires = Date.now() + 10 * 60 * 1000;
          return cache;
        })().finally(() => {
          pending = null;
        });
      res.json(await pending);
    } catch {
      throw new HttpError(
        502,
        "Recipe inspiration is temporarily unavailable. Our catering menu is still available.",
      );
    }
  });
  return router;
};
