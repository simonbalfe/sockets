import { Button } from "@headlessui/react";
import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  TbBook,
  TbLayoutSidebarLeftCollapse,
  TbLayoutSidebarLeftExpand,
} from "react-icons/tb";
import { twMerge } from "tailwind-merge";
import boardsIconDark from "~/assets/boards-dark.json";
import boardsIconLight from "~/assets/boards-light.json";
import ReactiveButton from "~/components/ReactiveButton";
import UserMenu from "~/components/UserMenu";
import { useTheme } from "~/providers/theme";

interface SideNavigationProps {
  user: UserType;
  isLoading: boolean;
  onCloseSideNav?: () => void;
}

interface UserType {
  displayName?: string | null | undefined;
  email?: string | null | undefined;
  image?: string | null | undefined;
}

export default function SideNavigation({
  user,
  isLoading,
  onCloseSideNav,
}: SideNavigationProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isInitialised, setIsInitialised] = useState(false);

  useEffect(() => {
    const savedState = localStorage.getItem("sockets_sidebar-collapsed");
    if (savedState !== null) {
      setIsCollapsed(Boolean(JSON.parse(savedState)));
    }
    setIsInitialised(true);
  }, []);

  useEffect(() => {
    if (isInitialised) {
      localStorage.setItem(
        "sockets_sidebar-collapsed",
        JSON.stringify(isCollapsed),
      );
    }
  }, [isCollapsed, isInitialised]);

  const pathname = location.pathname;

  const { resolvedTheme } = useTheme();

  const isDarkMode = resolvedTheme === "dark";

  const navigation = [
    {
      name: "Boards",
      href: "/boards",
      icon: isDarkMode ? boardsIconDark : boardsIconLight,
    },
  ];

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <nav
      className={twMerge(
        "flex h-full w-64 flex-col justify-between border-r border-light-300 bg-light-100 p-3 dark:border-dark-300 dark:bg-dark-100 md:border-r-0 md:py-0 md:pl-0",
        isCollapsed && "md:w-auto",
      )}
    >
      <div>
        <div className="hidden h-[45px] items-center justify-between pb-3 md:flex">
          {!isCollapsed && (
            <Link to="/" className="block">
              <h1 className="pl-2 text-[16px] font-bold tracking-tight text-neutral-900 dark:text-dark-1000">
                sockets
              </h1>
            </Link>
          )}
          <Button
            onClick={toggleCollapse}
            className={twMerge(
              "flex h-8 items-center justify-center rounded-md hover:bg-light-200 dark:hover:bg-dark-200",
              isCollapsed ? "w-full" : "w-8",
            )}
          >
            {isCollapsed ? (
              <TbLayoutSidebarLeftExpand
                size={18}
                className="text-light-900 dark:text-dark-900"
              />
            ) : (
              <TbLayoutSidebarLeftCollapse
                size={18}
                className="text-light-900 dark:text-dark-900"
              />
            )}
          </Button>
        </div>
        <div className="mx-1 mb-4 hidden w-auto border-b border-light-300 dark:border-dark-400 md:block" />

        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <ReactiveButton
                href={item.href}
                current={pathname.includes(item.href)}
                name={item.name}
                json={item.icon}
                isCollapsed={isCollapsed}
                onCloseSideNav={onCloseSideNav}
              />
            </li>
          ))}
          <li>
            <Link
              to="/resources"
              onClick={() => onCloseSideNav?.()}
              className={twMerge(
                "group flex h-[34px] items-center rounded-md p-1.5 text-sm font-normal leading-6 hover:bg-light-200 hover:text-light-1000 dark:hover:bg-dark-200 dark:hover:text-dark-1000",
                isCollapsed ? "md:justify-center" : "justify-between",
                pathname.includes("/resources")
                  ? "bg-light-200 text-light-1000 dark:bg-dark-200 dark:text-dark-1000"
                  : "text-neutral-600 dark:bg-dark-100 dark:text-dark-900",
              )}
              title={isCollapsed ? "Resources" : undefined}
            >
              <div
                className={twMerge(
                  "flex items-center",
                  isCollapsed
                    ? "justify-start gap-x-3 md:justify-center md:gap-x-0"
                    : "gap-x-3",
                )}
              >
                <TbBook size={18} className="shrink-0" />
                <span className={twMerge(isCollapsed && "md:hidden")}>
                  Resources
                </span>
              </div>
            </Link>
          </li>
        </ul>
      </div>

      <div className="space-y-2">
        <UserMenu
          displayName={user.displayName ?? undefined}
          email={user.email ?? "Email not provided?"}
          imageUrl={user.image ?? undefined}
          isLoading={isLoading}
          isCollapsed={isCollapsed}
          onCloseSideNav={onCloseSideNav}
        />
      </div>
    </nav>
  );
}
