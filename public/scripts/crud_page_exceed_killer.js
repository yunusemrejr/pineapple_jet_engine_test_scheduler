document.addEventListener('DOMContentLoaded', async () => {
    setInterval(()=>{   triggered()},2000);
      
      let detailedButtonClicked = false;
      let taskButtonClicked = false;
    
      const checkButtons = () => {
          const detailedButton = document.getElementById('detailedSubmitButton');
          const taskButton = document.getElementById('taskSubmitButton');
    
          if (detailedButton && taskButton) {
              detailedButton.addEventListener('click', () => {
                  detailedButtonClicked = true;
                  triggerFunctionIfBothClicked();
              });
    
              taskButton.addEventListener('click', () => {
                  taskButtonClicked = true;
                  triggerFunctionIfBothClicked();
              });
          }
      };
    
      const triggerFunctionIfBothClicked = () => {
          if (detailedButtonClicked && taskButtonClicked) {
              yourFunction();
          }
      };
    
      const observer = new MutationObserver(() => {
          checkButtons();
      });
    
      observer.observe(document.body, {
          childList: true,
          subtree: true
      });
    
      checkButtons();
    });
    
    async function triggered() {
      try {
          const response = await fetch('/analyze-hourly-tasks', {
              method: 'GET',
              headers: {
                  'Content-Type': 'application/json'
              }
          });
    
          if (!response.ok) {
              throw new Error('Failed to fetch task analysis');
          }
    
          const analysisData = await response.json();
    
          for (const task of analysisData) {
              if (task.limitExceeded) {
                  await deleteExceedingTask(task.statusId);
              }
          }
      } catch (error) {
          console.error('Error:', error);
      }
    }
    
    async function deleteExceedingTask(statusId) {
      try {
          const response = await fetch(`/delete-task/${statusId}`, {
              method: 'DELETE',
              headers: {
                  'Content-Type': 'application/json'
              }
          });
    
          if (!response.ok) {
              throw new Error(`Failed to delete task with ID ${statusId}`);
          }
    
          console.log(`Task with ID ${statusId} deleted successfully`);
          notifyWrapper(`Task with ID ${statusId} deleted because it exceeded the limit!`);
          setTimeout(() => {
              window.location.reload();
          },3000);
      } catch (error) {
          console.error('Error:', error);
      }
    }
    
    async function yourFunction() {
      console.log('Both buttons clicked!');
      await triggered();
    }