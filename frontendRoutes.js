 

const express = require("express");
const router = express.Router();

const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");

// Frontend routes
router.get("/", (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
  } else {
    res.redirect("/main-selection-page", { message: req.query.msg });
  }
});

router.get("/error", (req, res) => {
  res.render("general/error_page", { message: req.query.msg });
});

router.get("/login", (req, res) => {
  if (!req.session.user) {
    res.render("general/login_page");
  } else {
    res.redirect("/main-selection-page");
  }
});

router.get("/main-selection-page", (req, res) => {
  if (req.session.user) {
    res.render("general/main_selection_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/daily-test-summary", (req, res) => {
  if (req.session.user) {
    res.render("general/daily_test_summary", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});
 


router.get("/view-active-tests-page", (req, res) => {
  if (req.session.user) {
    res.render("general/view_active_tests_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});


router.get("/resource-usage-status", (req, res) => {
  if (req.session.user) {
    res.render("general/resource_usage_status", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/view-range-tests-page", (req, res) => {
  if (req.session.user) {
    res.render("general/view_range_tests_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/tests-crud-page", (req, res) => {
  if (req.session.user) {
    res.render("general/tests_crud_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/admin-panel-page", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/admin_panel_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/edit-roles-page", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/edit_roles_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/edit-predefined", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/edit_predefined", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/view-permissions-list-page", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/view_permissions_list_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/edit-users-page", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/edit_users_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/edit-test-types-page", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/edit_test_types_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/edit-test-resource-limits-page", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/edit_test_resource_limits_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

router.get("/edit-resource-types-page", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/edit_resource_types_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});



router.get("/create_user", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/create_user", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});
router.get("/delete-predefineds-page", (req, res) => {
  if (req.session.user && req.session.user.userRole === 1) {
    res.render("admin/delete_predefineds_page", {
      user: req.session.user,
      isUserAdmin: req.session.isUserAdmin,
      canUserCreate: req.session.canUserCreate,
      canUserEdit: req.session.canUserEdit,
      canUserDelete: req.session.canUserDelete,
      testsUserCanModify: req.session.testsUserCanModify,
      canUserViewAnyTest: req.session.canUserViewAnyTest,
      userRole: req.session.user.userRole,
    });
  } else {
    res.redirect("/login");
  }
});

module.exports = router;
