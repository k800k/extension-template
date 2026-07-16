/* SPDX-License-Identifier: GPL-3.0-or-later */

export const works = [
  {
    id: "moon-garden",
    title: "The Moon Garden",
    coverURL: "https://example.com/images/moon-garden-cover.jpg",
    synopsis: "A gardener discovers a city that blooms only by moonlight.",
    installments: [
      {
        id: "moon-garden-1",
        number: 1,
        title: "First Bloom",
        pages: [
          "https://example.com/images/moon-garden-1-001.jpg",
          "https://example.com/images/moon-garden-1-002.jpg",
        ],
      },
    ],
  },
  {
    id: "paper-sea",
    title: "The Paper Sea",
    coverURL: "https://example.com/images/paper-sea-cover.jpg",
    synopsis: "Two cartographers cross an ocean drawn anew each morning.",
    installments: [
      {
        id: "paper-sea-1",
        number: 1,
        title: "Unfolding",
        pages: ["https://example.com/images/paper-sea-1-001.jpg"],
      },
    ],
  },
] as const;
