const { createClient } = require("@nexrender/api");
const { render } = require("@nexrender/core");
const { getRenderingStatus } = require("@nexrender/types/job");
const argv = require("minimist")(process.argv.slice(2));

const secret = "myapisecret";
const host = "http://buzzle-nexrender-server.herokuapp.com";

const fetchJob = async (uid) => {
  const response = await fetch(`${host}/api/v1/jobs/${uid}`, {
    headers: {
      "nexrender-secret": secret,
    },
  });
  return await response.json();
};

const renderJob = async (uid) => {
  const settings = { stopOnError: true };
  const client = createClient({ host, secret });

  let job = await fetchJob(uid);
  console.log(job);
  job.state = "started";
  job.startedAt = new Date();

  try {
    await client.updateJob(job.uid, job);
  } catch (err) {
    console.log(
      `[${job.uid}] error while updating job state to ${job.state}. Job abandoned.`
    );
    console.log(`[${job.uid}] error stack: ${err.stack}`);
  }

  try {
    job.onRenderProgress = function (job, progress) {
      try {
        /* send render progress to our server */
        client.updateJob(job.uid, getRenderingStatus(job));
      } catch (err) {
        if (settings.stopOnError) {
          throw err;
        } else {
          console.log(`[${job.uid}] error occurred: ${err.stack}`);
        }
      }
    };

    job = await render(job, settings);
    {
      job.state = "finished";
      job.finishedAt = new Date();
    }

    await client.updateJob(job.uid, getRenderingStatus(job));
  } catch (err) {
    job.state = "error";
    job.error = err;
    job.errorAt = new Date();

    await client.updateJob(job.uid, getRenderingStatus(job));

    if (settings.stopOnError) {
      throw err;
    } else {
      console.log(`[${job.uid}] error occurred: ${err.stack}`);
    }
  }
};
if (!argv.uid) console.error("UID is required");
else renderJob(argv.uid);

module.exports = { renderJob };
