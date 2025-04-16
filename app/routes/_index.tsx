import type { MetaFunction } from "@remix-run/react";

import { Home } from "~/components/home.tsx";
import { NavBar } from "~/components/nav-bar.tsx";
import { Results } from "~/components/results.tsx";
import { Search } from "~/components/search.tsx";
import { TooltipProvider } from "~/components/ui/tooltip.tsx";
import { SearchProvider } from "~/hooks/use-search.tsx";

export const meta: MetaFunction = () => {
  return [
    { title: "nightwatch" },
    { name: "description", content: "A public archive of investigations into crypto scams and bad actors." },

    // Open Graph
    { property: "og:title", content: "nightwatch" },
    { property: "og:description", content: "A public archive of investigations into crypto scams and bad actors." },
    { property: "og:image", content: "https://nightwatch.polareth.org/og-image.png" },
    { property: "og:url", content: "https://nightwatch.polareth.org" },
    { property: "og:type", content: "website" },

    // Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "nightwatch" },
    { name: "twitter:description", content: "A public archive of investigations into crypto scams and bad actors." },
    { name: "twitter:image", content: "https://nightwatch.polareth.org/og-image.png" },
  ];
};

export default function Index() {
  return (
    <SearchProvider>
      <div className="flex flex-col items-center justify-items-center min-h-screen max-h-screen max-w-[1400px] mx-auto">
        <header className="w-full">
          <NavBar />
        </header>
        <main className="flex flex-col gap-2 p-2 sm:p-4 overflow-hidden flex-1 w-full">
          <Search />
          <TooltipProvider>
            <Results />
            <Home />
          </TooltipProvider>
        </main>
        <footer className="flex justify-center px-4 py-2 text-muted-foreground text-xs">
          Data on this app is updated every few hours. Is is intended to be a convenient archive rather than a real-time
          monitoring source.
        </footer>
      </div>
    </SearchProvider>
  );
}

// const resources = [
//   {
//     href: "https://remix.run/start/quickstart",
//     text: "Quick Start (5 min)",
//     icon: (
//       <svg
//         xmlns="http://www.w3.org/2000/svg"
//         width="24"
//         height="20"
//         viewBox="0 0 20 20"
//         fill="none"
//         className="stroke-gray-600 group-hover:stroke-current dark:stroke-gray-300"
//       >
//         <path
//           d="M8.51851 12.0741L7.92592 18L15.6296 9.7037L11.4815 7.33333L12.0741 2L4.37036 10.2963L8.51851 12.0741Z"
//           strokeWidth="1.5"
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />
//       </svg>
//     ),
//   }
// ];
