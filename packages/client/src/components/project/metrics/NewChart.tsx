import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { GetCheckpoints } from "./__generated__/GetCheckpoints";
import { gql, useQuery } from "@apollo/client";
import React, { ReactElement } from "react";

type Datapoint = {
  [key: string]: number;
};

type PointEvent = {
  payload: {
    name: string;
  };
};

const GET_CHECKPOINTS = gql`
  query GetCheckpoints($id: ID!) {
    project(id: $id) {
      checkpoints {
        id
        name
        step
        precision
      }
    }
  }
`;

export default function NewChart(props: { id: string; choose: (para: string) => void }): ReactElement {
  const { data, loading, error } = useQuery<GetCheckpoints>(GET_CHECKPOINTS, {
    variables: {
      id: props.id
    },
    pollInterval: 2000
  });
  if (loading) return <p>LOADING</p>;
  if (error) return <p>{error.message}</p>;
  if (data === undefined || data.project === null) return <p>NO DATA</p>;
  const checkpoints = data.project.checkpoints;

  const points: Datapoint[] = checkpoints.map((checkpoint) => {
    const point: Datapoint = { name: checkpoint.step };

    if (checkpoint.precision !== null) point["precision"] = checkpoint.precision;
    //here we list all the wonderful metrics that dont yet come

    return point;
  });

  function handleClick(step: number) {
    const checkpoint = checkpoints.find((checkpoint) => checkpoint.step === step);
    if (checkpoint) props.choose(checkpoint.id);
  }

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <ResponsiveContainer width="80%" height={400}>
        <LineChart
          data={points}
          margin={{
            top: 5,
            right: 10,
            left: 10,
            bottom: 5
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />

          <Line
            type="monotone"
            dataKey="precision"
            stroke="#8884d8"
            activeDot={{ r: 8, onClick: (event: PointEvent) => handleClick(parseInt(event.payload.name)) }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
