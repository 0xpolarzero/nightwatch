import type { MetaFunction } from "@remix-run/react";

import { NavBar } from "~/components/nav-bar.tsx";
import { Results } from "~/components/results.tsx";
import { Search } from "~/components/search.tsx";
import { SearchProvider } from "~/hooks/use-search.tsx";

export const meta: MetaFunction = () => {
  return [
    { title: "nightwatch" },
    { name: "description", content: "A public archive of investigations into crypto scams and bad actors." },
  ];
};

export default function Index() {
  return (
    <SearchProvider>
      <div className="grid grid-rows-[auto_1fr_auto] items-center justify-items-center min-h-screen p-4 gap-8 max-w-[1400px] mx-auto">
        <header>
          <NavBar />
        </header>
        <main className="flex flex-col gap-2">
          <Search />
          <Results />
        </main>
        <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center"></footer>
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
