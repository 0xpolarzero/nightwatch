import type { MetaFunction } from "@remix-run/node";

import { Results } from "~/components/results";
import { Search } from "~/components/search";
import { SearchProvider } from "~/hooks/use-search";

export const meta: MetaFunction = () => {
  return [{ title: "sleuth" }, { name: "description", content: "TODO_description" }];
};

export default function Index() {
  return (
    <SearchProvider>
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
        <header className="row-start-1">
          <h1 className="text-4xl font-bold">sleuth</h1>
        </header>
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
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
