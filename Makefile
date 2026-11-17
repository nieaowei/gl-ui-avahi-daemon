include $(TOPDIR)/rules.mk

PKG_NAME:=gl-ui-avahi-daemon
# Release preparation pins these to OpenWrt's Avahi package plus the UI commit.
PKG_VERSION:=0.9_rc5
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-only

include $(INCLUDE_DIR)/package.mk

# Build host only; install locked minifiers with npm ci in this directory.
AVAHI_NODE ?= node

define Package/gl-ui-avahi-daemon
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Native GL.iNet SDK4 interface for Avahi
  URL:=https://github.com/nieaowei/gl-ui-avahi-daemon
  DEPENDS:=+gl-sdk4-ui-core +gl-oui-rpc +avahi-daemon +luci-lib-nixio +luci-lib-ip
  PKGARCH:=all
endef

define Package/gl-ui-avahi-daemon/description
  Manage Avahi configuration and service state in the native GL.iNet admin UI.
endef

define Build/Compile
	rm -rf $(PKG_BUILD_DIR)/root
	$(AVAHI_NODE) $(CURDIR)/scripts/build-assets.cjs $(PKG_BUILD_DIR)/root
	AVAHI_TEST_ROOT=$(PKG_BUILD_DIR)/root $(AVAHI_NODE) --test $(CURDIR)/scripts/test-ui.cjs
endef

define Package/gl-ui-avahi-daemon/install
	$(CP) $(PKG_BUILD_DIR)/root/* $(1)/
endef

define Package/gl-ui-avahi-daemon/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || { nginx -t -q && nginx -s reload; }
exit 0
endef

define Package/gl-ui-avahi-daemon/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || { nginx -t -q && nginx -s reload; }
exit 0
endef

$(eval $(call BuildPackage,gl-ui-avahi-daemon))
