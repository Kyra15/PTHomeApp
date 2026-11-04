// Expo config plugin: adopt the UIKit scene life cycle.
//
// Apps built with the newest iOS SDK (Xcode 26+) refuse to launch without it:
//   "Application failed to launch: UIScene life cycle is required for apps built with this SDK."
// Expo SDK 57's generated AppDelegate still creates the window in application(_:didFinishLaunchingWithOptions:),
// so on every `expo prebuild` this plugin:
//   1. adds UIApplicationSceneManifest to Info.plist, pointing at SceneDelegate
//   2. keeps creating the React Native factory in AppDelegate, but starts React Native in the scene's window
//   3. appends a SceneDelegate that also forwards links and foreground/background events to the AppDelegate,
//      so Expo modules and React Native's AppState keep getting them (UIKit stops sending them to the app
//      delegate once scenes are adopted).
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const MARKER = '// [withSceneLifecycle]';

const START_IN_APP_DELEGATE = /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\(\s*\n?\s*withModuleName: "main",\s*\n?\s*in: window,\s*\n?\s*launchOptions: launchOptions\)\s*\n\s*#endif/;

const SCENE_DELEGATE = `
${MARKER} React Native starts here, in the scene's window (UIKit scene life cycle).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = appDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    // A link that cold-started the app becomes the launch URL, so Linking.getInitialURL() still sees it.
    var launchOptions = appDelegate.launchOptions ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)

    if let activity = connectionOptions.userActivities.first {
      _ = appDelegate.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = appDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }
}
`;

function withSceneInfoPlist(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'swift' || src.includes(MARKER)) return cfg;

    if (!START_IN_APP_DELEGATE.test(src)) {
      throw new Error(
        '[withSceneLifecycle] AppDelegate.swift no longer matches the expected Expo template. ' +
          'If this Expo version adopts UIScene itself, remove "./plugins/withSceneLifecycle" from app.json.',
      );
    }

    // 1. Don't create the window at launch — the scene does that. Keep the launch options for it.
    src = src.replace(
      START_IN_APP_DELEGATE,
      `${MARKER} The window and React Native start in SceneDelegate.\n    self.launchOptions = launchOptions`,
    );
    src = src.replace(
      '  var reactNativeFactory: RCTReactNativeFactory?\n',
      '  var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n',
    );
    if (!src.includes('var launchOptions:')) {
      throw new Error('[withSceneLifecycle] Could not add launchOptions to AppDelegate.swift.');
    }
    // 2. UIKit types for the scene delegate.
    if (!/^import UIKit$/m.test(src)) src = `import UIKit\n${src}`;
    // 3. The scene delegate itself.
    cfg.modResults.contents = `${src.trimEnd()}\n${SCENE_DELEGATE}`;
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneInfoPlist(config));
};
