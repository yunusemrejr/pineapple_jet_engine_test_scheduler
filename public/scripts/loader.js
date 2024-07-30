const loaderRun = () => {
  (function () {
    class LoadingScreen {
      constructor() {
        this.createLoader();
        this.startLoading();
      }

      createLoader() {
        // Create styles
        const style = document.createElement("style");
        style.textContent = `
                    .loader-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 10, 20, 0.94);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        z-index: 9999;
                        color: #fff;
                        font-family: Arial, sans-serif;
                    }
    
                    .loader-box {
                        text-align: center;
                    }
    
                    .loader-box .loader-icon {
                        width: 120px;
                        height: 120px;
                        margin-bottom: 20px;
                    }
    
                    .loader-box .loader-text {
                        font-size: 20px;
                        color: #cce7ff;
                    }
    
                    .loader-icon{
                    border-radius: 50%;
                    }
                `;
        document.head.appendChild(style);

        // Create loader overlay
        this.loaderOverlay = document.createElement("div");
        this.loaderOverlay.className = "loader-overlay";

        // Create loader box
        const loaderBox = document.createElement("div");
        loaderBox.className = "loader-box";

        // Add loader icon (turbine propeller GIF)
        const loaderIcon = document.createElement("img");
        loaderIcon.className = "loader-icon";
        loaderIcon.src = "media/engine-plane.gif"; // Replace with actual GIF URL
        loaderBox.appendChild(loaderIcon);

        // Add loader text
        const loaderText = document.createElement("div");
        loaderText.className = "loader-text";
        loaderText.textContent = `Initializing ${
          document.querySelector("title").textContent
        }...`;
        loaderBox.appendChild(loaderText);

        this.loaderOverlay.appendChild(loaderBox);
        document.body.appendChild(this.loaderOverlay);
      }

      startLoading() {
        setTimeout(() => {
          this.loaderOverlay.style.display = "none";
        }, 1000);
      }
    }

    // Activate the loading screen
    new LoadingScreen();
  })();
};

loaderRun();