import {
  afterPatch,
  fakeRenderComponent,
  findInReactTree,
  findInTree,
  findModuleByExport,
  MenuItem,
  Navigation,
  Patch,
} from "@decky/ui";
import { FC } from "react";

const MENU_KEY = "deck-recall";

function resolveAppId(tree: any, fallback: number): number {
  try {
    const roots = Array.isArray(tree) ? tree : [tree];
    // Steam can reuse a cached menu component. Prefer the app ID carried by
    // the actual menu items over the render callback's previous app ID.
    for (const root of roots) {
      const ownerId = root?._owner?.pendingProps?.overview?.appid;
      if (Number.isInteger(ownerId) && ownerId > 0 && ownerId !== fallback) return ownerId;
    }
    for (const root of roots) {
      const ownerId = root?._owner?.pendingProps?.overview?.appid;
      if (Number.isInteger(ownerId) && ownerId > 0) return ownerId;
      const found = findInTree(root, (node) => Number.isInteger(node?.app?.appid), {
        walkable: ["props", "children"],
      });
      if (Number.isInteger(found?.app?.appid) && found.app.appid > 0) return found.app.appid;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function isGameContextMenu(items: any[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  try {
    const hasLaunchSource = Boolean(findInReactTree(items, (node) => node?.props?.onSelected?.toString?.().includes("launchSource")));
    if (hasLaunchSource) return true;
    // Non-Steam shortcuts can have compatdata and a valid Steam shortcut ID,
    // but their library menu does not always contain Steam's launchSource.
    const hasProperties = Boolean(findInReactTree(items, (node) => node?.props?.onSelected?.toString?.().includes("AppProperties")));
    return hasProperties && resolveAppId(items, 0) > 0;
  } catch {
    return false;
  }
}

function insertMenuItem(items: any[], fallbackAppId: number): void {
  if (!isGameContextMenu(items)) return;
  const duplicateIndex = items.findIndex((item) => item?.key === MENU_KEY);
  if (duplicateIndex >= 0) items.splice(duplicateIndex, 1);

  const appId = resolveAppId(items, fallbackAppId);
  if (!Number.isInteger(appId) || appId <= 0) return;
  const propertiesIndex = items.findIndex((item) => {
    try {
      return Boolean(findInReactTree(item, (node) => node?.onSelected?.toString?.().includes("AppProperties")));
    } catch {
      return false;
    }
  });
  const insertionIndex = propertiesIndex >= 0 ? propertiesIndex : items.length;
  items.splice(insertionIndex, 0, <MenuItem key={MENU_KEY} onSelected={() => {
    Navigation.Navigate(`/deckrecall/${appId}`);
  }}>DeckRecall</MenuItem>);
}

function findLibraryContextMenu(): any | undefined {
  try {
    const module = findModuleByExport((candidate: any) => candidate?.toString?.().includes("().LibraryContextMenu"));
    if (!module || (typeof module !== "object" && typeof module !== "function")) return undefined;
    const candidate = Object.values(module).find((sibling: any) => sibling?.toString?.().includes("navigator:"));
    if (!candidate) return undefined;
    return fakeRenderComponent(candidate as FC).type;
  } catch (error) {
    console.warn("[DeckRecall] Could not locate the Steam game context menu", error);
    return undefined;
  }
}

export function installGameContextMenuPatch(): { unpatch(): void } {
  const LibraryContextMenu = findLibraryContextMenu();
  if (!LibraryContextMenu?.prototype?.render) return { unpatch() {} };

  let innerPatch: Patch | undefined;
  let menuRenderPatch: Patch | undefined;
  let menuUpdatePatch: Patch | undefined;
  const outerPatch = afterPatch(LibraryContextMenu.prototype, "render", (_args: unknown[], component: any) => {
    try {
      const appId = resolveAppId(component, 0);
      if (!innerPatch && component?.type) {
        innerPatch = afterPatch(component, "type", (_innerArgs: unknown[], rendered: any) => {
          try {
            if (!menuRenderPatch && rendered?.type?.prototype?.render) {
              menuRenderPatch = afterPatch(rendered.type.prototype, "render", (_renderArgs: unknown[], menu: any) => {
                try {
                  insertMenuItem(menu?.props?.children?.[0], appId);
                } catch (error) {
                  console.warn("[DeckRecall] Could not add the game menu item", error);
                }
                return menu;
              });
            }
            if (!menuUpdatePatch && rendered?.type?.prototype?.shouldComponentUpdate) {
              menuUpdatePatch = afterPatch(rendered.type.prototype, "shouldComponentUpdate", ([nextProps]: any[], shouldUpdate: boolean) => {
                try {
                  if (shouldUpdate === true) insertMenuItem(nextProps?.children, appId);
                } catch (error) {
                  console.warn("[DeckRecall] Could not refresh the game menu item", error);
                }
                return shouldUpdate;
              });
            }
          } catch (error) {
            console.warn("[DeckRecall] Could not patch the inner game menu", error);
          }
          return rendered;
        });
      } else {
        insertMenuItem(component?.props?.children, appId);
      }
    } catch (error) {
      console.warn("[DeckRecall] Game menu patch skipped", error);
    }
    return component;
  });

  return {
    unpatch() {
      menuUpdatePatch?.unpatch();
      menuRenderPatch?.unpatch();
      innerPatch?.unpatch();
      outerPatch?.unpatch();
    },
  };
}
