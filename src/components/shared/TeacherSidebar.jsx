function TeacherSidebar({ open = false, active = "", onNavigate, onLogout }) {
  const navItems = [
    {
      key: "dashboard",
      label: "Dashboard",
      icon: "/icons/dashboard.png",
      path: "/teacher/dashboard",
    },
    {
      key: "classes",
      label: "My Classes",
      icon: "/icons/myclasses.png",
      path: "/teacher/classes",
    },
    {
      key: "settings",
      label: "Settings",
      icon: "/icons/settings.png",
      path: "/settings",
    },
  ];

  return (
    <aside className={`dash-sidebar ${open ? "open" : ""}`}>
      <div className="side-brand">
        <img src="/leaf-logo.png" alt="Class Connect" />
        <h2>Class Connect</h2>
      </div>

      {navItems.map((item) => (
        <button
          type="button"
          key={item.key}
          className={active === item.key ? "side-active" : ""}
          onClick={() => onNavigate(item.path)}
        >
          <img src={item.icon} alt="" />
          <span>{item.label}</span>
        </button>
      ))}

      <button type="button" className="side-logout" onClick={onLogout}>
        <img src="/icons/logout.png" alt="" />
        <span>Logout</span>
      </button>
    </aside>
  );
}

export default TeacherSidebar;
