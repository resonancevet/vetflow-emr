import type { MetadataRoute } from "next";

const baseUrl = "https://openvpm.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/features`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/why`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/install`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
  ];
}
