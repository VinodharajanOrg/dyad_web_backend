# GitHub Integration Flow

This document provides an overview of how to link an application to a GitHub repository and publish local updates to the remote repository.

## Step 1: Publish Generated Code

After generating the code, the interface will display a **Publish** option for pushing the code to GitHub. Select **Publish** to initiate the upload process.

![Screenshot 1](./docs/images/git_flow_screenshot/Screenshot1.png)

## Step 2: Connect to GitHub

When you click **Publish** and there is no active GitHub connection, the UI will display a **Connect to GitHub** button. Click **Connect to GitHub** to initiate the connection process.

![Screenshot 2](./docs/images/git_flow_screenshot/Screenshot2.png)

## Step 3: Authorization Code and External Link

When you select **Connect to GitHub**, the system generates an external authorization link along with a verification code. Copy the code and navigate to the external URL to complete the authorization process.

![Screenshot 3](./docs/images/git_flow_screenshot/Screenshot3.png)

## Step 4: Create or Connect to Repository

After the authorization is complete, you will be presented with two options: **Create Repository** or **Connect to Existing Repository**. When creating a new repository, the system will prefill the repository name with the application name and set the default branch to **main**. You may update both values as needed, then click on **Create Repo**.

![Screenshot 4](./docs/images/git_flow_screenshot/Screenshot4.png)

## Step 5: Code Pushed to GitHub

Once you select **Create Repo**, the application automatically pushes the generated code to GitHub. The **Publish** panel will then display the linked repository and the branch currently in use.

![Screenshot 5](./docs/images/git_flow_screenshot/Screenshot5.png)

## Step 6: Sync New Changes

When additional prompts generate new or updated files, you can push these changes to the connected repository by clicking the **Sync** option.

![Screenshot 6](./docs/images/git_flow_screenshot/Screenshot6.png)

## Step 7: Active GitHub Connection with New App

When creating a new app while a GitHub connection is already active, the system skips the connection setup step. In the **Publish** panel, you will directly see the options to **Create Repo** or **Connect to Existing Repo**, without needing to authorize GitHub again.

![Screenshot 7](./docs/images/git_flow_screenshot/Screenshot7.png)

## Step 8: Connect to Existing Repository

Upon selecting **Connect to Existing Repo**, the system will populate the **Select Repository** dropdown with all repositories associated with your GitHub account, as well as their corresponding branches. Choose the appropriate repository and branch to complete the connection process and click on **Connect to Repo**.

![Screenshot 8](./docs/images/git_flow_screenshot/Screenshot8.png)

## Step 9: Force Push if Needed

Once you select **Connect**, the system compares the current project files with the contents of the target repository. If they do not match, you will be prompted for a **Force Push**, as a standard fast-forward push is not possible. Select **Force Push** to replace the repository's existing code with the newly generated version.

![Screenshot 9.1](./docs/images/git_flow_screenshot/Screenshot9.1.png)

![Screenshot 9.2](./docs/images/git_flow_screenshot/Screenshot9.2.png)

## Step 10: Disconnect from GitHub

To remove an existing GitHub integration, navigate to any application and open the **Publish** section. When an active connection is present, it will be shown as **Connected to GitHub Repo**. Select **Disconnect from Repo** to terminate the current GitHub connection and again it will ask us to go through the authorization process of **Connect to GitHub**.

![Screenshot 10.1](./docs/images/git_flow_screenshot/Screenshot10.1.png)

![Screenshot 10.2](./docs/images/git_flow_screenshot/Screenshot10.2.png)

## Step 11: GitHub Operations from Apps Section

GitHub operations are not limited to the **Publish** section. By navigating to **Apps** and selecting an existing application, you will find the same GitHub integration options, allowing you to perform all required actions directly from the app's details page.

![Screenshot 11](./docs/images/git_flow_screenshot/Screenshot11.png)
