import { NavLink, useLocation } from "react-router-dom";

export const teacherBottomNavItems = [
  {
    to: "/teacher/dashboard",
    label: "Dashboard",
    icon: "/icons/dashboard.png",
  },
  {
    to: "/teacher/classes",
    label: "Classes",
    icon: "/icons/myclasses.png",
    activePrefixes: ["/teacher/classes", "/teacher/class/"],
  },
  {
    to: "/settings",
    label: "Settings",
    icon: "/icons/settings.png",
    activePrefixes: ["/settings"],
  },
];

export const studentBottomNavItems = [
  {
    to: "/student/classes",
    label: "Classes",
    icon: "/icons/myclasses.png",
    activePrefixes: ["/student/classes", "/student/class/"],
  },
  {
    to: "/student/settings",
    label: "Settings",
    icon: "/icons/settings.png",
    activePrefixes: ["/student/settings"],
  },
];

function BottomNav({ items = [], className = "bottom-nav" }) {
  const location = useLocation();

  if (items.length === 0) return null;

  return (
    <nav className={className} aria-label="Primary">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => {
            const prefixActive = item.activePrefixes?.some((prefix) =>
              location.pathname.startsWith(prefix)
            );

            return isActive || prefixActive ? "is-active" : "";
          }}
        >
          {item.icon && <img src={item.icon} alt="" />}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default BottomNav;
