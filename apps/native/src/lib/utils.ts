import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default scale, so it reads the iOS
// text-style sizes from global.css (`text-body`, `text-largeTitle`, ...) as
// text colors and drops them whenever a color class such as `text-primary`
// follows. Registering them as font sizes keeps both.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "footnote",
            "subheadline",
            "body",
            "title2",
            "title1",
            "largeTitle",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
