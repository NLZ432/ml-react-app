import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography
} from "@material-ui/core";
import { gql, useMutation, useQuery } from "@apollo/client";
import { QueryTestjobs } from "./__generated__/QueryTestjobs";
import { GetTests } from "./__generated__/GetTests";
import { GetVideos } from "./__generated__/GetVideos";
import React, { ChangeEvent } from "react";
import { CloudDownload } from "@material-ui/icons";
import { GetProjectData_project_exports } from "../__generated__/GetProjectData";
import VideoUploadButton from "./VideoUploadButton";
type Export = GetProjectData_project_exports;

const GET_TESTS = gql`
  query GetTests($id: ID!) {
    export(id: $id) {
      tests {
        name
        downloadPath
      }
    }
  }
`;

function TestList(props: { exprtID: string }): React.ReactElement {
  const { data, loading, error } = useQuery<GetTests>(GET_TESTS, {
    variables: { id: props.exprtID },
    pollInterval: 1000
  });
  if (loading) return <p>LOADING</p>;
  if (error) return <p>{error.message}</p>;
  if (data === undefined || data.export === undefined) return <p>NO DATA</p>;
  if (data.export?.tests?.length === 0) return <Typography> Nothing here yet. </Typography>;
  return (
    <List style={{ minWidth: 400 }}>
      {data.export?.tests?.map((test) => (
        <ListItem>
          <a download href={`http://localhost:4000/${test.downloadPath}`}>
            <ListItemIcon>
              <CloudDownload />
            </ListItemIcon>
          </a>
          <ListItemText>{test.name}</ListItemText>
        </ListItem>
      ))}
    </List>
  );
}

export default function TestHistory(props: { exprt: Export; handler: () => void }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const handleClick = () => {
    setOpen(true);
    props.handler();
  };
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <MenuItem onClick={handleClick}>
        <Typography variant={"body1"}>Test History</Typography>
      </MenuItem>
      <Dialog onClose={handleClose} open={open}>
        <DialogContent dividers>
          <Typography variant="h4" style={{ display: "flex", justifyContent: "center" }}>
            Testing
          </Typography>
          <TestInput exprt={props.exprt} />
          <FilteredTestjobs exprtID={props.exprt.id} />
          <TestList exprtID={props.exprt.id} />
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

const GET_VIDEOS = gql`
  query GetVideos($id: ID!) {
    project(id: $id) {
      videos {
        id
        name
        filename
        fullPath
      }
    }
  }
`;
function VideoSelect(props: {
  id: string;
  onSelect: (event: ChangeEvent<{ name?: string | undefined; value: unknown }>) => void;
}): React.ReactElement {
  const { data, loading, error } = useQuery<GetVideos>(GET_VIDEOS, {
    variables: {
      id: props.id
    },
    pollInterval: 2000
  });

  if (loading) return <p>LOADING</p>;
  if (error || !data) return <p>{error?.message}</p>;
  if (data.project === null) return <p>NOPROJECT</p>;

  return (
    <>
      <InputLabel>Select Video</InputLabel>
      <Select variant="outlined" onChange={props.onSelect}>
        {data.project?.videos.map((video) => (
          <MenuItem value={video.id}>{video.name}</MenuItem>
        ))}
        <VideoUploadButton id={props.id} />
      </Select>
    </>
  );
}

const TEST_MODEL_MUTATION = gql`
  mutation startTest($name: String!, $projectID: String!, $exportID: String!, $videoID: String!) {
    testModel(name: $name, projectID: $projectID, exportID: $exportID, videoID: $videoID) {
      id
    }
  }
`;

function TestInput(props: { exprt: Export }): React.ReactElement {
  const [testModel] = useMutation(TEST_MODEL_MUTATION);
  const [name, setName] = React.useState<string>(`${props.exprt.name}-test`);
  const [videoID, setVideoID] = React.useState<string>();

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };
  const handleVideoChange = (event: ChangeEvent<{ name?: string | undefined; value: unknown }>) => {
    setVideoID(event.target.value as string);
  };
  const handleTest = () => {
    const projectID = props.exprt.projectID;
    const exportID = props.exprt.id;
    testModel({ variables: { name, projectID, exportID, videoID } }).catch((err) => {
      console.log(err);
    });
  };

  return (
    <FormControl fullWidth>
      <FormControl style={{ width: "100%" }}>
        <VideoSelect id={props.exprt.projectID} onSelect={handleVideoChange} />
      </FormControl>
      <FormControl style={{ width: "100%" }}>
        <TextField margin={"normal"} variant="outlined" value={name} onChange={handleNameChange} />
      </FormControl>
      <FormControl style={{ width: "40%", display: "flex", justifyContent: "center" }}>
        <Button variant="outlined" color="primary" onClick={handleTest} disabled={!videoID}>
          Test
        </Button>
      </FormControl>
    </FormControl>
  );
}

const GET_TESTJOBS = gql`
  query QueryTestjobs {
    testjobs {
      name
      exportID
      streamPort
    }
  }
`;

function FilteredTestjobs(props: { exprtID: string }): React.ReactElement {
  const { data, loading, error } = useQuery<QueryTestjobs>(GET_TESTJOBS, {
    pollInterval: 1000
  });

  if (loading) return <p>LOADING</p>;
  if (error) return <p>{error.message}</p>;
  if (data === undefined) return <p>NO DATA</p>;

  const thisExportsTestjobs = data.testjobs.filter((job) => job.exportID === props.exprtID);

  return (
    <List dense={true}>
      {thisExportsTestjobs.map((job) => (
        <ListItem key={job.exportID}>
          <ListItemIcon>
            <CircularProgress />
          </ListItemIcon>
          <ListItemText primary={job.name} />
          <a href={`http://localhost:${job.streamPort}/stream.mjpg`} target="_blank" rel="noopener noreferrer">
            <Button variant="outlined" color={"secondary"}>
              View
            </Button>
          </a>
        </ListItem>
      ))}
    </List>
  );
}
