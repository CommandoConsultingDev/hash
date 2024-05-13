import "../../shared/testing-utilities/mock-get-flow-context";

import { expect, test } from "vitest";

import { inferFactsFromText } from "./infer-facts-from-text";

const microsoftWikipediaParagraph = `
Microsoft Corporation is an American multinational corporation and technology company headquartered in Redmond, Washington.[2] Microsoft's best-known software products are the Windows line of operating systems, the Microsoft 365 suite of productivity applications, and the Edge web browser. Its flagship hardware products are the Xbox video game consoles and the Microsoft Surface lineup of touchscreen personal computers. Microsoft ranked No. 14 in the 2022 Fortune 500 rankings of the largest United States corporations by total revenue;[3] and it was the world's largest software maker by revenue in 2022 according to Forbes Global 2000. It is considered one of the Big Five American information technology companies, alongside Alphabet (parent company of Google), Amazon, Apple, and Meta (parent company of Facebook).

Microsoft was founded by Bill Gates and Paul Allen on April 4, 1975, to develop and sell BASIC interpreters for the Altair 8800. It rose to dominate the personal computer operating system market with MS-DOS in the mid-1980s, followed by Windows. The company's 1986 initial public offering (IPO) and subsequent rise in its share price created three billionaires and an estimated 12,000 millionaires among Microsoft employees. Since the 1990s, it has increasingly diversified from the operating system market and has made several corporate acquisitions, the largest being the acquisition of Activision Blizzard for $68.7 billion in October 2023,[4] followed by its acquisition of LinkedIn for $26.2 billion in December 2016,[5] and its acquisition of Skype Technologies for $8.5 billion in May 2011.[6]

As of 2015, Microsoft is market-dominant in the IBM PC compatible operating system market and the office software suite market, although it has lost the majority of the overall operating system market to Android.[7] The company also produces a wide range of other consumer and enterprise software for desktops, laptops, tabs, gadgets, and servers, including Internet search (with Bing), the digital services market (through MSN), mixed reality (HoloLens), cloud computing (Azure), and software development (Visual Studio).

Steve Ballmer replaced Gates as CEO in 2000 and later envisioned a "devices and services" strategy.[8] This unfolded with Microsoft acquiring Danger Inc. in 2008,[9] entering the personal computer production market for the first time in June 2012 with the launch of the Microsoft Surface line of tablet computers, and later forming Microsoft Mobile through the acquisition of Nokia's devices and services division. Since Satya Nadella took over as CEO in 2014, the company has scaled back on hardware and instead focused on cloud computing, a move that helped the company's shares reach their highest value since December 1999.[10][11] Under Nadella's direction, the company has also heavily expanded its gaming business to support the Xbox brand, establishing the Microsoft Gaming division in 2022, dedicated to operating Xbox in addition to its three subsidiaries (publishers). Microsoft Gaming is the third-largest gaming company in the world by revenue as of 2024.[12]

In 2018, Microsoft became the most valuable publicly traded company in the world, a position it has repeatedly traded with Apple in the years since.[13] In April 2019, Microsoft reached a trillion-dollar market cap, becoming the third U.S. public company to be valued at over $1 trillion after Apple and Amazon, respectively. As of 2024, Microsoft has the third-highest global brand valuation.

Microsoft has been criticized for its monopolistic practices and the company's software has been criticized for problems with ease of use, robustness, and security.
`;

const microsoftWikipediaParagraphEntitySummaries = [
  {
    localId: "c4431ca0-e816-4d8c-86c4-4c97cb41e5d3",
    name: "Microsoft Corporation",
    summary:
      "An American multinational corporation and technology company, known for products like Windows, Microsoft 365, and Xbox, and as the world's largest software maker by revenue in 2022.",
  },
  {
    localId: "eb370e12-dec5-46e8-b70a-da168957f3e0",
    name: "Bill Gates",
    summary:
      "Co-founder of Microsoft, who along with Paul Allen, started the company in 1975.",
  },
  {
    localId: "7d30b6ff-4ec1-440f-b2d5-a1a9b83ea4d6",
    name: "Paul Allen",
    summary:
      "Co-founder of Microsoft alongside Bill Gates, contributing to the development and sale of BASIC interpreters for the Altair 8800.",
  },
  {
    localId: "0f383585-9af4-448c-a8b6-8e5a850260c3",
    name: "Activision Blizzard",
    summary:
      "A company acquired by Microsoft for $68.7 billion in October 2023, representing Microsoft's largest corporate acquisition.",
  },
  {
    localId: "3caad498-2365-42cd-a3fc-7042e3863bb5",
    name: "LinkedIn",
    summary:
      "Acquired by Microsoft in December 2016 for $26.2 billion, making it one of Microsoft's significant acquisitions.",
  },
  {
    localId: "d4a70cc3-51e8-434b-a5e9-3f28374dd407",
    name: "Skype Technologies",
    summary: "Acquired by Microsoft in May 2011 for $8.5 billion.",
  },
  {
    localId: "75579db3-0614-4776-a780-1ab84027f801",
    name: "Steve Ballmer",
    summary:
      'Replaced Bill Gates as CEO of Microsoft in 2000 and initiated a "devices and services" strategy.',
  },
  {
    localId: "a124d6dd-0a39-4216-b1f6-a5dd278f5ca7",
    name: "Satya Nadella",
    summary:
      "Became CEO of Microsoft in 2014, shifting the company's focus towards cloud computing and contributing to a significant increase in its share value.",
  },
  {
    localId: "27f9fc04-aef0-4688-8130-ca958a2fe9a3",
    name: "Microsoft Gaming",
    summary:
      "Established in 2022 as a division dedicated to supporting the Xbox brand and identified as the third-largest gaming company in the world by revenue as of 2024.",
  },
];

test(
  "Test getEntitySummariesFromText with a simple text",
  async () => {
    const { facts } = await inferFactsFromText({
      text: microsoftWikipediaParagraph,
      existingEntitySummaries: microsoftWikipediaParagraphEntitySummaries,
    });

    console.log(JSON.stringify({ facts }, null, 2));

    expect(facts).toBeDefined();
  },
  {
    timeout: 120_000,
  },
);
