import { useEffect, useState } from "react";

/**
 * Tiny hash router. Routes live in the URL fragment, which browsers never send to servers —
 * so a scanned address in "#/scan/<input>" never reaches any server log.
 */
export type Route =
  | { name: "home" }
  | { name: "scan"; input: string }
  | { name: "plan" }
  | { name: "pass" }
  | { name: "dashboard" }
  | { name: "watch" }
  | { name: "developers" }
  | { name: "embed"; input: string }
  | { name: "methodology"; anchor?: string };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  const [head = "", ...rest] = h.split("/");
  switch (head) {
    case "scan":
      return { name: "scan", input: decodeURIComponent(rest.join("/")) };
    case "plan":
      return { name: "plan" };
    case "pass":
      return { name: "pass" };
    case "dashboard":
      return { name: "dashboard" };
    case "watch":
      return { name: "watch" };
    case "developers":
      return { name: "developers" };
    case "embed":
      return { name: "embed", input: decodeURIComponent(rest.join("/")) };
    case "methodology":
      return { name: "methodology", anchor: rest[0] ? decodeURIComponent(rest[0]) : undefined };
    default:
      return { name: "home" };
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "scan":
      return `#/scan/${encodeURIComponent(route.input)}`;
    case "embed":
      return route.input ? `#/embed/${encodeURIComponent(route.input)}` : "#/embed";
    case "methodology":
      return route.anchor ? `#/methodology/${encodeURIComponent(route.anchor)}` : "#/methodology";
    default:
      return `#/${route.name}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route).slice(1);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
