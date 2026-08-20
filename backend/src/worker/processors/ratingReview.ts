import { RatingService } from "../../modules/credit/ratingService";

export async function processRatingReviews({ now = new Date() } = {}) {
  return new RatingService().generate(now);
}
