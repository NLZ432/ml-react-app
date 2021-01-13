import { List, ListItem, ListItemIcon, ListItemText } from "@material-ui/core";
import { GetExportjobs_exportjobs } from "./__generated__/GetExportjobs";
import { CircularProgress } from "@material-ui/core";
import { gql, useQuery } from "@apollo/client";
import { useMutation } from "@apollo/client";
import React, { ReactElement } from "react";
import NewChart from "./NewChart";

const EXPORT_CHECKPOINT_BUTTON_MUTATION = gql`
  mutation exportCheckpoint($id: ID!, $checkpointID: String!, $name: String!) {
    exportCheckpoint(id: $id, checkpointID: $checkpointID, name: $name) {
      id
    }
  }
`;

const GET_EXPORTJOBS = gql`
  query GetExportjobs {
    exportjobs {
      name
      checkpointID
      projectID
      exportID
    }
  }
`;

export default function Metrics(props: { id: string }): ReactElement {
  const [exportCheckpoint] = useMutation(EXPORT_CHECKPOINT_BUTTON_MUTATION);
  const { data, loading, error } = useQuery(GET_EXPORTJOBS, {
    pollInterval: 2000
  });
  if (loading) return <p>LOADING</p>;
  if (error) return <p>{error.message}</p>;
  if (data === undefined) return <p>NO DATA</p>;

  function onSet(checkpointID: string): void {
    const name = "EXPORT";
    const id = props.id;
    exportCheckpoint({ variables: { id, checkpointID, name } }).catch((err) => {
      console.log(err);
    });
  }

  return (
    <>
      <NewChart id={props.id} choose={onSet} />
      <Exportjobs jobs={data.exportjobs} id={props.id} />
    </>
  );
}

function Exportjobs(props: { jobs: GetExportjobs_exportjobs[]; id: string }): JSX.Element {
  const projectJobs = props.jobs.filter((job) => job.projectID === props.id);
  return (
    <>
      <List dense={true}>
        {projectJobs.map((job) => (
          <ListItem key={job.checkpointID}>
            <ListItemIcon>
              <CircularProgress />
            </ListItemIcon>
            <ListItemText primary={`exporting checkpoint "${job.name}"`} secondary={job.exportID} />
          </ListItem>
        ))}
      </List>
    </>
  );
}
