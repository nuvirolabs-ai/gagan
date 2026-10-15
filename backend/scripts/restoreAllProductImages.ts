import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

function norm(s: string) {
  return s.toLowerCase()
    .replace(/basmati rice/g, "")
    .replace(/rice/g, "")
    .replace(/flour/g, "")
    .replace(/dal/g, "")
    .replace(/mix/g, "")
    .replace(/chawali/g, "chawla")
    .replace(/moong/g, "mung")
    .replace(/red chana/g, "lal chana")
    .replace(/dahi vada/g, "dahivada")
    .replace(/laxmi /g, "")
    .replace(/[^a-z0-9]/g, "");
}

const coreImages: Record<string, string> = {
  "basmati rice": "/catalog-images/basmati-rice.png",
  "chana dal": "/catalog-images/chana-dal.png",
  "moong dal": "/catalog-images/moong-dal.png",
  "poha": "/catalog-images/poha.png",
  "sona masoori rice": "/catalog-images/sona-masoori-rice.png",
  "sugar": "/catalog-images/sugar.png",
  "urad dal": "/catalog-images/urad-dal.png",
  "toor dal": "/catalog-images/toor-dal-1kg.png",
  "lpp toor dal": "/catalog-images/real/47c6b982b6a1218c6ddb266333ce677950ff1bca15fb740fe6db107f610ab406.jpg",
  "neel gagan chawla": "/catalog-images/real/6ebd153a78f9777065491a58a8b5ac75baf07319f2fd1389d0556f4c2f213566.jpg",
  "neel gagan urad chilka dal": "/catalog-images/real/2040a65ae112a76240b46c17d25e901a3c2bc8bbfdde6b1c6f2bcbf86ea0bffe.jpg",
  "neel gagan rajma lal": "/catalog-images/real/807e8ceb38a85431cef557c7cc131cfb0e20b02ab0fd7ab54c1eea12634e1ac8.jpg",
  "neel gagan mung mogar": "/catalog-images/real/4d7f7f212ee8e5630b0b5554e485d3d14c6d87a5676c447f95852f2c164b5c5f.jpg",
};

async function main() {
  const prisma = new PrismaClient();
  const manifestPath = path.resolve(__dirname, "../../docs/real-catalogue/real-catalogue-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  
  console.log("Restoring product images across database...");
  const products = await prisma.product.findMany({ include: { variants: true } });
  
  let productsUpdated = 0;
  let variantsUpdated = 0;

  for (const product of products) {
    let chosenImageUrl: string | null = product.imageUrl;
    const lowerName = product.name.toLowerCase().trim();

    if (!chosenImageUrl) {
      if (coreImages[lowerName]) {
        chosenImageUrl = coreImages[lowerName];
      } else {
        const pNorm = norm(product.name);
        const match = manifest.records.find((r: any) => {
          const rNorm = norm(r.productName || "");
          return rNorm.length > 3 && (pNorm.includes(rNorm) || rNorm.includes(pNorm));
        });
        if (match && match.image?.assetPath) {
          chosenImageUrl = match.image.assetPath;
        }
      }
    }

    if (chosenImageUrl) {
      if (product.imageUrl !== chosenImageUrl) {
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: chosenImageUrl },
        });
        productsUpdated++;
      }

      // Update variants of this product
      for (const variant of product.variants) {
        let variantImg = variant.imageUrl;
        if (!variantImg) {
          // Check if variant has specific image in manifest
          const vMatch = manifest.records.find((r: any) => {
            const rNorm = norm(r.productName || "");
            const pNorm = norm(product.name);
            const matchesProd = rNorm.length > 3 && (pNorm.includes(rNorm) || rNorm.includes(pNorm));
            const matchesUnit = r.variantUnitSize?.trim().toLowerCase() === variant.unitSize.trim().toLowerCase();
            return matchesProd && matchesUnit;
          });

          variantImg = (vMatch && vMatch.image?.assetPath) ? vMatch.image.assetPath : chosenImageUrl;
        }

        if (variantImg && (variant.imageUrl !== variantImg || variant.catalogImageStatus !== "exact")) {
          await prisma.variant.update({
            where: { id: variant.id },
            data: {
              imageUrl: variantImg,
              catalogImageStatus: "exact",
            },
          });
          variantsUpdated++;
        }
      }
    }
  }

  console.log(`Successfully updated ${productsUpdated} products and ${variantsUpdated} variants with authentic product images.`);

  const stats = {
    totalProducts: await prisma.product.count(),
    productsWithImage: await prisma.product.count({ where: { imageUrl: { not: null } } }),
    totalVariants: await prisma.variant.count(),
    variantsWithImage: await prisma.variant.count({ where: { imageUrl: { not: null } } }),
  };

  console.log("Final database image coverage:", JSON.stringify(stats, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Failed to restore images:", e);
  process.exit(1);
});
