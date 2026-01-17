import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSetAtom } from "jotai";
import { activeSettingsSectionAtom } from "@/atoms/viewAtoms";

type ScrollOptions = {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
  onScrolled?: (id: string, element: HTMLElement) => void;
};

/**
 * Returns an async function that navigates to the given route, then scrolls the element with the provided id into view.
 */
export function useScrollAndNavigateTo(
  to: string = "/settings",
  options?: ScrollOptions,
) {
  const router = useRouter();
  const pathname = usePathname();
  const setActiveSection = useSetAtom(activeSettingsSectionAtom);

  return useCallback(
    async (id: string) => {
      // Only navigate if not already on the target page
      if (pathname !== to) {
        router.push(to);
      }

      // Wait for the element to appear in the DOM using MutationObserver
      const element = await new Promise<HTMLElement | null>((resolve) => {
        // Check immediately in case element exists
        const existing = document.getElementById(id);
        if (existing) {
          resolve(existing);
          return;
        }

        // Use MutationObserver to detect when element is added to DOM
        const observer = new MutationObserver(() => {
          const el = document.getElementById(id);
          if (el) {
            observer.disconnect();
            resolve(el);
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: false,
        });

        // Timeout fallback after 5 seconds
        const _timeout = setTimeout(() => {
          observer.disconnect();
          resolve(document.getElementById(id));
        }, 2000);
      });

      if (element) {
        element.scrollIntoView({
          behavior: options?.behavior ?? "smooth",
          block: options?.block ?? "start",
          inline: options?.inline,
        });
        setActiveSection(id);
        options?.onScrolled?.(id, element);
        return true;
      }
      return false;
    },
    [
      router,
      pathname,
      to,
      options?.behavior,
      options?.block,
      options?.inline,
      options?.onScrolled,
      setActiveSection,
    ],
  );
}
